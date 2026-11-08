import { test, expect, vi } from 'vitest'
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { initializePresets, managePresets, PRESETS } from '../src/codex/presets.ts'
import type { Codex } from '../src/codex/rpc.ts'

async function fixture(presets: Record<string, unknown> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'delta-preset-setup-'))
  const statePath = join(directory, 'delta', 'presets.json')
  let version = 0
  const call = vi.fn(async (method: string, params: any): Promise<any> => {
    if (method === 'config/read')
      return {
        config: { tui: { presets: structuredClone(presets) } },
        layers: [
          {
            name: { type: 'user', file: join(directory, 'config.toml') },
            version: String(version),
            config: { tui: { presets: structuredClone(presets) } },
          },
        ],
      }
    expect(method).toBe('config/batchWrite')
    expect(params.expectedVersion).toBe(String(version))
    for (const edit of params.edits) {
      const slot = edit.keyPath.split('.').at(-1)
      if (edit.value === null) delete presets[slot]
      else presets[slot] = edit.value
    }
    version++
    return {}
  })
  return {
    directory,
    statePath,
    presets,
    call,
    rpc: () => ({ call, close: vi.fn().mockResolvedValue(undefined) }) as unknown as Codex,
    close: () => rm(directory, { recursive: true, force: true }),
  }
}

test('automatic presets preserve occupied/customized slots and later edits and deletions', async () => {
  const f = await fixture({
    '1': { label: 'Mine', input: 'Keep me' },
    '2': { label: 'Delta status', input: 'My custom status workflow' },
  })
  try {
    expect((await initializePresets(f.rpc())).context).toContain('3: Delta share')
    expect(Object.keys(f.presets)).toHaveLength(4)
    expect(f.presets['2']).toEqual({ label: 'Delta status', input: 'My custom status workflow' })
    delete f.presets['3']
    f.presets['4'] = { label: 'My join', input: 'Customized' }
    const original = structuredClone(f.presets)
    expect(await initializePresets(f.rpc())).toEqual({})
    expect(f.presets).toEqual(original)
    expect(JSON.parse(await readFile(f.statePath, 'utf8')).status).toBe('complete')
  } finally {
    await f.close()
  }
})

test('explicit removal before startup opts out, and explicit install restores setup', async () => {
  const f = await fixture()
  try {
    await managePresets('remove', f.rpc())
    expect(await initializePresets(f.rpc())).toEqual({})
    expect(f.presets).toEqual({})
    expect((await managePresets('install', f.rpc())).changed).toBe(3)
    f.presets['1'] = { ...PRESETS[0], input: 'Customized status' }
    expect((await managePresets('remove', f.rpc())).changed).toBe(2)
    expect(await initializePresets(f.rpc())).toEqual({})
    expect(f.presets).toEqual({ '1': { ...PRESETS[0], input: 'Customized status' } })
    expect(JSON.parse(await readFile(f.statePath, 'utf8')).status).toBe('disabled')
  } finally {
    await f.close()
  }
})

test('full slots and native write failures warn without marking setup complete; a later session retries', async () => {
  const f = await fixture(
    Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), { label: 'Mine', input: 'Mine' }])),
  )
  try {
    expect((await initializePresets(f.rpc())).warning).toContain('Not enough empty preset slots')
    expect(Object.keys(f.presets)).toHaveLength(10)
    await expect(readFile(f.statePath)).rejects.toHaveProperty('code', 'ENOENT')
    for (const slot of ['1', '2', '3']) delete f.presets[slot]
    const implementation = f.call.getMockImplementation()!
    f.call.mockImplementation(async (method, params) => {
      if (method === 'config/batchWrite') throw new Error('Concurrent config edit')
      return implementation(method, params)
    })
    expect((await initializePresets(f.rpc())).warning).toContain('Concurrent config edit')
    await expect(readFile(f.statePath)).rejects.toHaveProperty('code', 'ENOENT')
    f.call.mockImplementation(implementation)
    expect((await initializePresets(f.rpc())).context).toContain('1: Delta status')
    expect(Object.keys(f.presets)).toHaveLength(10)
  } finally {
    await f.close()
  }
})

test('concurrent startup and removal serialize without duplicate or partial presets', async () => {
  const f = await fixture()
  let release!: () => void
  const paused = new Promise<void>((resolve) => {
    release = resolve
  })
  let writing!: () => void
  const started = new Promise<void>((resolve) => {
    writing = resolve
  })
  const implementation = f.call.getMockImplementation()!
  f.call.mockImplementation(async (method, params) => {
    if (method === 'config/batchWrite') {
      writing()
      await paused
    }
    return implementation(method, params)
  })
  const first = initializePresets(f.rpc())
  try {
    await started
    expect((await initializePresets(f.rpc())).warning).toContain('already running')
    await expect(managePresets('remove', f.rpc())).rejects.toThrow('already running')
    release()
    expect((await first).context).toContain('Delta status')
    expect(await initializePresets(f.rpc())).toEqual({})
    expect(Object.keys(f.presets)).toHaveLength(3)
    await managePresets('remove', f.rpc())
    expect(await initializePresets(f.rpc())).toEqual({})
    expect(f.presets).toEqual({})
  } finally {
    release()
    await first
    await f.close()
  }
})

test('preset setup recovers a lock from an exited process without deleting saved setup state', async () => {
  const f = await fixture()
  try {
    const child = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' })
    expect(child.status).toBe(0)
    await mkdir(join(f.directory, 'delta'))
    await writeFile(`${f.statePath}.lock`, JSON.stringify({ pid: child.pid }))
    expect((await initializePresets(f.rpc())).context).toContain('Delta status')
    expect(Object.keys(f.presets)).toHaveLength(3)
    await expect(readFile(`${f.statePath}.lock`)).rejects.toHaveProperty('code', 'ENOENT')
  } finally {
    await f.close()
  }
})
