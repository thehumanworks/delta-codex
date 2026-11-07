import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

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
    'dist/panel.html',
    'dist/THIRD_PARTY_NOTICES.txt',
    'bin/delta-codex.mjs',
    'hooks/hooks.json',
    'skills/delta/SKILL.md',
    'skills/delta/references/setup.md',
    'skills/delta/references/workflows.md',
    'skills/share/SKILL.md',
    'skills/join/SKILL.md',
    'skills/status/SKILL.md',
    'skills/setup/SKILL.md',
    '.mcp.json',
    '.codex-plugin/plugin.json',
    '.agents/plugins/marketplace.json',
    'LICENSE',
    'NOTICE',
  ])
    assert(files.includes(required), `Missing ${required}`)
  assert(
    !files.some(
      (file) =>
        file.includes('node_modules') ||
        file.endsWith('.tmp') ||
        file.includes('bridge.json') ||
        file.startsWith('plans/'),
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
  assert(!files.includes('plugin.json'), 'Keep compatibility manifest hook coverage')
  const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version
  assert.equal(run(process.execPath, [join(root, 'bin', 'delta-codex.mjs'), '--version']).trim(), version)
  assert.equal(JSON.parse(await readFile(join(root, '.codex-plugin/plugin.json'), 'utf8')).version, version)
  assert(
    run(process.execPath, [join(root, 'bin', 'delta-codex.mjs'), '--help']).includes('delta-codex share'),
  )
  const hooks = JSON.parse(await readFile(join(root, 'hooks', 'hooks.json'), 'utf8'))
  assert.equal(Object.keys(hooks.hooks).length, 9)
  const mcp = JSON.parse(await readFile(join(root, '.mcp.json'), 'utf8')).mcpServers.delta
  const client = new Client({ name: 'clean-package-check', version: '1' })
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: mcp.args,
        cwd: resolve(root, mcp.cwd),
        env: { DELTA_CODEX_HOME: join(directory, 'unused-state') },
      }),
    )
    assert((await client.listTools()).tools.some((tool) => tool.name === 'delta_panel'))
    const resource = await client.readResource({ uri: 'ui://delta/workspace.html' })
    assert(resource.contents[0].text.includes('Work together'))
  } finally {
    await client.close()
  }
  console.log(
    `Verified ${output.filename}: ${files.length} files, ${output.size} bytes, executable after clean installation.`,
  )
} finally {
  await rm(directory, { recursive: true, force: true })
}
