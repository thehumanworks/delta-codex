import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { EventEmitter } from 'node:events'
import { MAX_FRAME, terminate } from '../core/process.ts'

export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message)
  }
}

/** Connects to the user's existing Codex daemon; never starts a second agent harness. */
export class Codex extends EventEmitter {
  private child?: ChildProcessWithoutNullStreams
  private opening?: Promise<void>
  private next = 0
  private pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
  >()
  private done: Promise<void> = Promise.resolve()
  private stderr = ''
  readonly requests = new Map<string, { id: number | string; method: string; params: any }>()
  constructor(
    readonly argv = [process.env.DELTA_CODEX_CODEX_BIN || 'codex', 'app-server', 'proxy'],
    readonly environment: NodeJS.ProcessEnv = {},
  ) {
    super()
  }

  async connect() {
    if (this.opening) return this.opening
    this.opening = this.open()
    try {
      await this.opening
    } catch (error) {
      this.opening = undefined
      throw error
    }
  }

  private async open() {
    const child = (this.child = spawn(this.argv[0]!, this.argv.slice(1), {
      stdio: 'pipe',
      windowsHide: true,
      shell: false,
      env: { ...process.env, ...this.environment },
    }))
    const lines = createInterface({ input: child.stdout })
    child.stdin.on('error', () => {})
    child.stderr.on('data', (chunk) => {
      this.stderr = (this.stderr + chunk.toString()).slice(-2000)
    })
    let length = 0
    child.stdout.on('data', (chunk: Buffer) => {
      const last = chunk.lastIndexOf(10)
      length = last < 0 ? length + chunk.length : chunk.length - last - 1
      if (length > MAX_FRAME) child.kill()
    })
    lines.on('line', (line) => {
      try {
        if (line.length > MAX_FRAME) throw new Error('Oversize Codex frame')
        const message = JSON.parse(line)
        if ('id' in message && !message.method) {
          const request = this.pending.get(message.id)
          if (request) {
            this.pending.delete(message.id)
            clearTimeout(request.timer)
            message.error
              ? request.reject(new RpcError(message.error.code, message.error.message))
              : request.resolve(message.result)
          }
        } else if ('id' in message) {
          // The caller must surface server requests. Never synthesize approval.
          this.requests.set(String(message.id), message)
          if (this.listenerCount('request')) this.emit('request', message)
          else this.respond(String(message.id), undefined, 'No interactive approval handler is attached')
        } else this.emit('notification', message)
      } catch (error) {
        this.emit('diagnostic', String(error))
        child.kill()
      }
    })
    this.done = new Promise((resolve) => {
      const closed = () => {
        for (const request of this.pending.values()) {
          clearTimeout(request.timer)
          request.reject(new Error(`Codex daemon disconnected. ${this.stderr}`))
        }
        this.pending.clear()
        this.requests.clear()
        this.opening = undefined
        this.child = undefined
        lines.close()
        resolve()
      }
      child.once('error', closed)
      child.once('close', closed)
    })
    await this.request(
      'initialize',
      {
        clientInfo: { name: 'delta_codex', title: 'Delta for Codex', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      },
      10_000,
    )
    this.send({ method: 'initialized', params: {} })
  }

  private send(value: unknown) {
    if (!this.child?.stdin.writable)
      throw new Error('Codex daemon is not connected. Start Codex with its shared daemon enabled.')
    this.child.stdin.write(JSON.stringify(value) + '\n')
  }

  private request<T>(method: string, params: unknown, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.next
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex ${method} timed out`))
      }, timeout)
      this.pending.set(id, { resolve, reject, timer })
      try {
        this.send({ id, method, params })
      } catch (error) {
        this.pending.delete(id)
        clearTimeout(timer)
        reject(error)
      }
    })
  }

  async call<T = any>(method: string, params: unknown, timeout = 30_000): Promise<T> {
    await this.connect()
    return this.request<T>(method, params, timeout)
  }
  respond(id: string, result?: unknown, error?: string) {
    const request = this.requests.get(id)
    if (!request) throw new Error('This Codex approval request is no longer pending')
    this.send(
      error ? { id: request.id, error: { code: -32601, message: error } } : { id: request.id, result },
    )
    this.requests.delete(id)
  }
  async close() {
    if (this.child) await terminate(this.child, this.done)
  }
}

export type Rpc = Pick<Codex, 'call'>

/** Page all persisted turns. Never truncate history to a guessed transcript tail. */
export async function history(rpc: Rpc, threadId: string, throughTurn?: string): Promise<any[]> {
  const turns: any[] = [],
    cursors = new Set<string>()
  let cursor: string | undefined
  try {
    do {
      const page = await rpc.call('thread/turns/list', {
        threadId,
        cursor,
        limit: throughTurn ? 20 : 100,
        sortDirection: throughTurn ? 'desc' : 'asc',
        itemsView: 'full',
      })
      if (!Array.isArray(page.data)) throw new Error('Invalid Codex turn history')
      for (const turn of page.data) {
        if (turn.itemsView !== 'full') {
          turn.items = []
          let itemCursor: string | undefined
          const seen = new Set<string>()
          do {
            const items = await rpc.call('thread/items/list', {
              threadId,
              turnId: turn.id,
              cursor: itemCursor,
              sortDirection: 'asc',
              limit: 100,
            })
            if (!Array.isArray(items.data)) throw new Error('Invalid Codex item history')
            turn.items.push(...items.data.map((entry: any) => entry.item))
            itemCursor = items.nextCursor ?? undefined
            if (itemCursor && seen.has(itemCursor)) throw new Error('Codex repeated an item cursor')
            if (itemCursor) seen.add(itemCursor)
          } while (itemCursor)
        }
        turns.push(turn)
        if (throughTurn && turn.id === throughTurn) return turns.reverse()
      }
      cursor = page.nextCursor ?? undefined
      if (cursor && cursors.has(cursor)) throw new Error('Codex repeated a turn cursor')
      if (cursor) cursors.add(cursor)
    } while (cursor)
    return throughTurn ? turns.reverse() : turns
  } catch (error) {
    // Legacy rollout stores don't implement pagination. Only unsupported-method errors permit fallback.
    if (!(error instanceof RpcError) || ![-32601, -32600].includes(error.code)) throw error
    const value = await rpc.call('thread/read', { threadId, includeTurns: true })
    if (!Array.isArray(value.thread?.turns)) throw new Error('Codex cannot provide this session history')
    return value.thread.turns
  }
}
