import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'

export type Result = { code: number | null; stdout: string; stderr: string }
export type Runner = (
  argv: string[],
  options?: { cwd?: string; input?: string; timeout?: number; onStderr?: (text: string) => void },
) => Promise<Result>
export const MAX_FRAME = 32 * 1024 * 1024

export const run: Runner = (argv, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(argv[0]!, argv.slice(1), {
      cwd: options.cwd,
      windowsHide: true,
      stdio: 'pipe',
      shell: false,
      env: { ...process.env, DELTA_INTEGRATION: 'codex' },
    })
    let stdout = '',
      stderr = '',
      failure: Error | undefined
    let killTimer: NodeJS.Timeout | undefined
    const fail = (error: Error) => {
      if (failure) return
      failure = error
      child.kill('SIGTERM')
      killTimer = setTimeout(() => child.kill('SIGKILL'), 2500)
    }
    const timer = setTimeout(() => {
      fail(new Error(`Command timed out: ${argv.slice(0, 3).join(' ')}`))
    }, options.timeout ?? 120_000)
    const capture = (which: 'stdout' | 'stderr', chunk: string) => {
      if (which === 'stdout') stdout += chunk.toString()
      else {
        stderr += chunk
        options.onStderr?.(chunk)
      }
      if (stdout.length + stderr.length > MAX_FRAME) {
        fail(new Error('Command output exceeds the capture limit; no acknowledgment assumed'))
      }
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => capture('stdout', chunk))
    child.stderr.on('data', (chunk) => capture('stderr', chunk))
    child.on('error', (error) => {
      clearTimeout(timer)
      clearTimeout(killTimer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      clearTimeout(killTimer)
      failure ? reject(failure) : resolve({ code, stdout, stderr })
    })
    child.stdin.on('error', () => {})
    child.stdin.end(options.input)
  })

export type Stream = { ready: Promise<unknown>; done: Promise<void>; stop: () => Promise<void> }

/** Both output pipes are drained for the entire mount/watch lifetime. */
export function stream(argv: string[], onLine?: (line: string) => void): Stream {
  const child = spawn(argv[0]!, argv.slice(1), {
    windowsHide: true,
    stdio: 'pipe',
    shell: false,
    env: { ...process.env, DELTA_INTEGRATION: 'codex' },
  })
  let resolveReady!: (value: unknown) => void, rejectReady!: (error: Error) => void
  let first = true,
    stopped = false,
    stderr = ''
  const ready = new Promise<unknown>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  // The watch caller can consume frames without using ready.
  void ready.catch(() => {})
  let length = 0
  child.stdout.on('data', (chunk: Buffer) => {
    const last = chunk.lastIndexOf(10)
    length = last < 0 ? length + chunk.length : chunk.length - last - 1
    if (length > MAX_FRAME) {
      rejectReady(new Error('Delta stream frame too large'))
      child.kill()
    }
  })
  const lines = createInterface({ input: child.stdout })
  lines.on('line', (line) => {
    try {
      if (line.length > MAX_FRAME) throw new Error('Delta stream frame too large')
      if (first) {
        first = false
        resolveReady(JSON.parse(line))
      }
      onLine?.(line)
    } catch (error) {
      rejectReady(error as Error)
      child.kill()
    }
  })
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4096)
  })
  const done = new Promise<void>((resolve, reject) => {
    child.on('error', (error) => {
      rejectReady(error)
      reject(error)
    })
    child.on('close', (code) => {
      lines.close()
      rejectReady(new Error(stderr || `Delta stream exited ${code}`))
      if (stopped || code === 0) resolve()
      else reject(new Error(stderr || `Delta stream exited ${code}`))
    })
  })
  void done.catch(() => {})
  return {
    ready,
    done,
    stop: async () => {
      stopped = true
      await terminate(child, done)
    },
  }
}

export async function terminate(child: ChildProcessWithoutNullStreams, done: Promise<unknown>) {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  const timer = setTimeout(() => child.kill('SIGKILL'), 2500)
  try {
    await done.catch(() => {})
  } finally {
    clearTimeout(timer)
  }
}

export async function deadline<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
