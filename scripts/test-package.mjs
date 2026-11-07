import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'

const directory = await mkdtemp(join(tmpdir(), 'delta-package-'))
const run = (command, args, cwd = process.cwd()) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result.stdout
}
try {
  const output = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', directory]))[0]
  const files = output.files.map((file) => file.path)
  for (const required of [
    'dist/cli.js',
    'bin/delta-codex.mjs',
    'hooks/hooks.json',
    'skills/delta/SKILL.md',
    '.codex-plugin/plugin.json',
    '.agents/plugins/marketplace.json',
    'LICENSE',
    'NOTICE',
  ])
    assert(files.includes(required), `Missing ${required}`)
  assert(
    !files.some(
      (file) => file.includes('node_modules') || file.endsWith('.tmp') || file.includes('bridge.json'),
    ),
  )
  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--prefix',
    directory,
    join(directory, output.filename),
  ])
  const root = join(directory, 'node_modules', 'delta-codex')
  assert.equal(run(process.execPath, [join(root, 'bin', 'delta-codex.mjs'), '--version']).trim(), '0.1.0')
  assert(
    run(process.execPath, [join(root, 'bin', 'delta-codex.mjs'), '--help']).includes('delta-codex share'),
  )
  const hooks = JSON.parse(await readFile(join(root, 'hooks', 'hooks.json'), 'utf8'))
  assert.equal(Object.keys(hooks.hooks).length, 9)
  console.log(
    `Verified ${output.filename}: ${files.length} files, ${output.size} bytes, executable after clean installation.`,
  )
} finally {
  await rm(directory, { recursive: true, force: true })
}
