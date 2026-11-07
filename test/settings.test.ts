import { test, expect } from 'vitest'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { run } from '../src/core/process.ts'
import { readPolicy, writePolicy } from '../src/settings.ts'

test('setup preserves unrelated settings and locally excludes private policy', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'delta-settings-'))
  try {
    await run(['git', 'init', dir])
    await mkdir(join(dir, '.delta'))
    await writeFile(join(dir, '.delta', 'settings.json'), JSON.stringify({ custom: 'keep' }))
    await writePolicy(dir, { mode: 'private', organization: 'org_test' })
    expect(await readPolicy(dir)).toEqual({ mode: 'private', organization: 'org_test' })
    expect(JSON.parse(await readFile(join(dir, '.delta', 'settings.json'), 'utf8')).custom).toBe('keep')
    expect((await run(['git', '-C', dir, 'check-ignore', '.delta/settings.json'])).code).toBe(0)
    await writeFile(join(dir, '.delta', 'settings.json'), '{invalid')
    await expect(readPolicy(dir)).rejects.toThrow()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('tracked policy is never silently rewritten', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'delta-tracked-'))
  try {
    await run(['git', 'init', dir])
    await mkdir(join(dir, '.delta'))
    await writeFile(join(dir, '.delta', 'settings.json'), '{}')
    await run(['git', '-C', dir, 'add', '.delta/settings.json'])
    await expect(writePolicy(dir, { mode: 'manual' })).rejects.toThrow('tracked')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
