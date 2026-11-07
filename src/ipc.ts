import { createServer, createConnection, type Socket } from 'node:net'
import { mkdir, chmod, unlink, open, stat, lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { Bridge, type Hook } from './bridge.ts'
import { atomicJson, digest, readJson } from './core/storage.ts'
import { MAX_FRAME, deadline } from './core/process.ts'

type Endpoint = { token: string; socket: string; pid: number; version: 1 }
export type Request = { method: string; params: any }
const endpointFile = (directory: string) => join(directory, 'bridge.json')

function readFrame(socket: Socket, onValue: (value: any) => void) {
  let pending = ''
  socket.setEncoding('utf8')
  socket.on('data', (chunk: string) => {
    pending += chunk
    if (pending.length > MAX_FRAME) {
      socket.destroy(new Error('IPC request too large'))
      return
    }
    const newline = pending.indexOf('\n')
    if (newline < 0) return
    const frame = pending.slice(0, newline)
    pending = ''
    try {
      onValue(JSON.parse(frame))
    } catch {
      socket.destroy()
    }
  })
}

export async function request(directory: string, message: Request, timeout = 180_000): Promise<any> {
  const endpoint = await readJson<Endpoint>(endpointFile(directory))
  if (!endpoint || endpoint.version !== 1) throw new Error('Delta bridge is not running')
  if (process.platform !== 'win32') {
    const info = await lstat(endpointFile(directory))
    if (info.isSymbolicLink() || info.mode & 0o077 || info.uid !== process.getuid?.())
      throw new Error('Insecure Delta bridge endpoint permissions')
  }
  return new Promise((resolve, reject) => {
    const socket = createConnection(endpoint.socket)
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error('Delta bridge request timed out; inspect status before retrying a mutation'))
    }, timeout)
    const finish = () => clearTimeout(timer)
    socket.once('error', (error) => {
      finish()
      reject(error)
    })
    socket.once('connect', () => socket.write(JSON.stringify({ token: endpoint.token, ...message }) + '\n'))
    let received = false
    socket.once('close', () => {
      finish()
      if (!received)
        reject(new Error('Delta bridge disconnected before replying; inspect status before retrying'))
    })
    readFrame(socket, (value) => {
      received = true
      finish()
      socket.end()
      value.error ? reject(new Error(value.error)) : resolve(value.result)
    })
  })
}

/** Spawn once per Codex profile. Lock ownership is checked in serve, including competing hooks. */
export async function ensureBridge(directory: string, entrypoint: string) {
  try {
    await request(directory, { method: 'ping', params: {} }, 1000)
    return
  } catch {
    /* Start or recover. */
  }
  const child = spawn(process.execPath, [entrypoint, 'serve'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, DELTA_CODEX_HOME: directory },
  })
  child.on('error', () => {})
  child.unref()
  await deadline(
    (async () => {
      for (;;) {
        try {
          await request(directory, { method: 'ping', params: {} }, 500)
          return
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      }
    })(),
    10_000,
    'Starting Delta bridge',
  )
}

export async function serve(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  if (process.platform !== 'win32') await chmod(directory, 0o700)
  const lockPath = join(directory, 'bridge.lock')
  let lock
  try {
    lock = await open(lockPath, 'wx', 0o600)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const owner = await readJson<{ pid: number }>(lockPath).catch(() => undefined)
    if (!owner && Date.now() - (await stat(lockPath)).mtimeMs < 10_000) return // A competing process may still be writing its lock.
    if (owner)
      try {
        process.kill(owner.pid, 0)
        return
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return
      }
    // Rename-free stale lock recovery is serialized by an additional exclusive claim.
    let claim
    try {
      claim = await open(`${lockPath}.recovery`, 'wx', 0o600)
    } catch {
      return
    }
    try {
      await unlink(lockPath)
      lock = await open(lockPath, 'wx', 0o600)
    } finally {
      await claim.close()
      await unlink(`${lockPath}.recovery`).catch(() => {})
    }
  }
  await lock.writeFile(JSON.stringify({ pid: process.pid }))
  await lock.sync()
  const token = randomBytes(32).toString('hex')
  const socketDirectory = join(tmpdir(), `delta-codex-${digest(directory).slice(0, 20)}`)
  await mkdir(socketDirectory, { recursive: true, mode: 0o700 })
  if (process.platform !== 'win32') {
    const info = await lstat(socketDirectory)
    if (info.isSymbolicLink() || info.uid !== process.getuid?.() || info.mode & 0o077)
      throw new Error('Insecure Delta socket directory')
  }
  const socketPath =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\delta-codex-${digest(directory).slice(0, 24)}`
      : join(socketDirectory, 'bridge.sock')
  if (process.platform !== 'win32') await unlink(socketPath).catch(() => {})
  const bridge = new Bridge(directory)
  const server = createServer((socket) => {
    socket.on('error', () => {})
    socket.setTimeout(180_000, () => socket.destroy())
    let handled = false
    readFrame(socket, (value) => {
      if (handled) return
      handled = true
      const supplied = Buffer.from(typeof value.token === 'string' ? value.token : '')
      if (supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) {
        socket.end(JSON.stringify({ error: 'Unauthorized local request' }) + '\n')
        return
      }
      void dispatch(bridge, value, () => {
        setTimeout(() => void close(), 10)
      }).then(
        (result) => socket.end(JSON.stringify({ result }) + '\n'),
        (error) =>
          socket.end(
            JSON.stringify({ error: String(error instanceof Error ? error.message : error) }) + '\n',
          ),
      )
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(socketPath, resolve)
  })
  if (process.platform !== 'win32') await chmod(socketPath, 0o600)
  await atomicJson(endpointFile(directory), { token, socket: socketPath, pid: process.pid, version: 1 })
  void bridge.start().catch(() => {})
  let closing = false
  const close = async () => {
    if (closing) return
    closing = true
    server.close()
    await bridge.close()
    await unlink(endpointFile(directory)).catch(() => {})
    await lock.close()
    await unlink(lockPath).catch(() => {})
    process.exit(0)
  }
  process.on('SIGINT', () => void close())
  process.on('SIGTERM', () => void close())
}

async function dispatch(bridge: Bridge, request: Request, shutdown?: () => void) {
  const p = request.params ?? {}
  switch (request.method) {
    case 'ping':
      return { version: '0.1.0', pid: process.pid }
    case 'shutdown':
      shutdown?.()
      return { stopping: true }
    case 'hook':
      return bridge.hook(p as Hook)
    case 'share':
      return bridge.share(p)
    case 'join':
      return bridge.join(p.reference)
    case 'status':
      return bridge.inspect(p.session)
    case 'setup':
      return bridge.setup(p.cwd, p.policy)
    case 'retry':
      return bridge.retry(p.session)
    case 'stop':
      await bridge.stop(p.session)
      return { stopped: p.session }
    case 'resolve':
      return bridge.recover(p.session, p.action)
    case 'branch':
      return bridge.branch(p.session, p.name, p.isolated)
    case 'run':
      return bridge.runThread(p.session, p.reference, p.prompt, p.write)
    case 'send':
      return bridge.send(p.session, p.turn, p.prompt)
    case 'interrupt':
      return bridge.interrupt(p.session, p.turn)
    case 'pending':
      return bridge.pending(p.session)
    case 'answer':
      return bridge.answer(p.id, p.decision, p.answers)
    case 'wait':
      return bridge.wait(p.session, p.seconds)
    default:
      throw new Error(`Unknown Delta bridge operation: ${request.method}`)
  }
}
