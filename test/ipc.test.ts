import { test, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createConnection } from 'node:net'
import { request } from '../src/ipc.ts'
import { run } from '../src/core/process.ts'

test('the packaged bridge serves hooks over private IPC, rejects wrong tokens, and shuts down cleanly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'delta-ipc-'))
  await run(['git', 'init', directory])
  const processChild = spawn(process.execPath, [resolve('dist/cli.js'), 'serve'], {
    stdio: 'ignore',
    env: {
      ...process.env,
      DELTA_CODEX_HOME: directory,
      DELTA_CODEX_CODEX_BIN: join(directory, 'missing-codex'),
      DELTA_CODEX_DELTA_BIN: join(directory, 'missing-delta'),
    },
  })
  const ended = new Promise<void>((resolve) => processChild.on('exit', () => resolve()))
  try {
    let ready = false
    for (let n = 0; n < 100; n++) {
      try {
        await request(directory, { method: 'ping', params: {} }, 100)
        ready = true
        break
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
    }
    expect(ready).toBe(true)
    const result = await request(directory, {
      method: 'hook',
      params: { hook_event_name: 'SessionStart', session_id: 'native-fixture', cwd: directory },
    })
    expect(result.hookSpecificOutput.additionalContext).toContain('native-fixture')
    const endpoint = JSON.parse(await readFile(join(directory, 'bridge.json'), 'utf8'))
    if (process.platform !== 'win32')
      expect((await stat(join(directory, 'bridge.json'))).mode & 0o077).toBe(0)
    const rejected = await new Promise<string>((resolve, reject) => {
      const socket = createConnection(endpoint.socket)
      socket.on('error', reject)
      socket.once('connect', () => socket.write(JSON.stringify({ token: 'bad', method: 'ping' }) + '\n'))
      socket.once('data', (data) => {
        resolve(data.toString())
        socket.end()
      })
    })
    expect(JSON.parse(rejected).error).toContain('Unauthorized')
    expect(await request(directory, { method: 'status', params: {} })).toEqual({ sessions: [] })
    expect(await request(directory, { method: 'shutdown', params: {} })).toEqual({ stopping: true })
    await ended
  } finally {
    processChild.kill('SIGTERM')
    await ended
    await rm(directory, { recursive: true, force: true })
  }
}, 10_000)
