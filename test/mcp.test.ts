import { test, expect, vi } from 'vitest'
import { mkdtemp, rm, readdir, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer, PANEL_URI, bounded } from '../src/mcp/server.ts'
import { Operations } from '../src/operations.ts'
import { atomicJson } from '../src/core/storage.ts'
import { Recording, freshBinding, stage } from '../src/recording/store.ts'
import { managePresets } from '../src/codex/presets.ts'
import type { Codex } from '../src/codex/rpc.ts'
import { run } from '../src/core/process.ts'

async function fixture() {
  const ops = new Operations('unused', '/unused')
  const panel = vi.spyOn(ops, 'panel').mockImplementation(async (session) => ({
    session: session ? ({ session } as any) : null,
    boundSession: session ?? null,
    observedAt: '2026-11-07',
    guidance: 'Fixture',
  }))
  const share = vi.spyOn(ops, 'share').mockResolvedValue({ thread: 'opaque:thread' })
  const bridge = vi.spyOn(ops, 'bridge').mockResolvedValue({
    session: 'joined-session',
    directory: '/tmp/test',
    resume: ['codex', 'resume', 'joined-session'],
  })
  const server = createMcpServer(ops, async () => '<html>Fixture</html>')
  const client = new Client({ name: 'test', version: '1' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(a)
  await client.connect(b)
  return {
    client,
    server,
    panel,
    share,
    bridge,
    close: async () => {
      await client.close()
      await server.close()
    },
  }
}

test('discovery is side-effect free, tools describe effects and the panel resource is constrained', async () => {
  const f = await fixture()
  try {
    const { tools } = await f.client.listTools()
    expect(tools.find((t) => t.name === 'delta_panel')?._meta?.ui).toMatchObject({ resourceUri: PANEL_URI })
    expect(tools.find((t) => t.name === 'delta_share')?.annotations?.readOnlyHint).toBe(false)
    expect(tools.find((t) => t.name === 'delta_status')?.annotations?.readOnlyHint).toBe(true)
    expect(tools.some((t) => /exec|approve|answer/.test(t.name))).toBe(false)
    const resource = await f.client.readResource({ uri: PANEL_URI })
    expect(resource.contents[0]?._meta).toMatchObject({
      ui: { csp: { connectDomains: [], resourceDomains: [] } },
    })
    expect(f.panel).not.toHaveBeenCalled()
    expect(f.bridge).not.toHaveBeenCalled()
    expect(f.share).not.toHaveBeenCalled()
  } finally {
    await f.close()
  }
})

test('host thread binds tools, explicit reads remain possible and cross-thread writes fail', async () => {
  const f = await fixture()
  try {
    const panel: any = await f.client.callTool({
      name: 'delta_panel',
      arguments: {},
      _meta: { threadId: 'caller' },
    })
    expect(panel.structuredContent.data.boundSession).toBe('caller')
    expect(f.panel).toHaveBeenCalledWith('caller')
    await f.client.callTool({
      name: 'delta_panel',
      arguments: { session: 'other' },
      _meta: { threadId: 'caller' },
    })
    expect(f.panel).toHaveBeenCalledWith('other')
    const refused: any = await f.client.callTool({
      name: 'delta_share',
      arguments: { session: 'other', organization: 'org', audience: 'private' },
      _meta: { threadId: 'caller' },
    })
    expect(refused.isError).toBe(true)
    expect(f.share).not.toHaveBeenCalled()
    const absent: any = await f.client.callTool({
      name: 'delta_share',
      arguments: { organization: 'org', audience: 'private' },
    })
    expect(absent.isError).toBe(true)
    expect(f.share).not.toHaveBeenCalled()
    await f.client.callTool({
      name: 'delta_share',
      arguments: { organization: 'org', audience: 'private' },
      _meta: { threadId: 'caller' },
    })
    expect(f.share).toHaveBeenCalledWith(expect.objectContaining({ session: 'caller', audience: 'private' }))
  } finally {
    await f.close()
  }
})

test('invalid audience cannot reach the bridge and repeated join clicks are deduplicated', async () => {
  const f = await fixture()
  try {
    const invalid: any = await f.client.callTool({
      name: 'delta_share',
      arguments: { session: 'caller', audience: 'public', organization: 'org' },
    })
    expect(invalid.isError).toBe(true)
    expect(f.share).not.toHaveBeenCalled()
    const request = {
      name: 'delta_join',
      arguments: { reference: 'opaque:child/ref', operationId: 'one-click' },
    }
    const result: any = await f.client.callTool(request)
    await f.client.callTool(request)
    expect(f.bridge).toHaveBeenCalledTimes(1)
    expect(f.bridge).toHaveBeenCalledWith('join', { reference: 'opaque:child/ref' })
    expect(result.structuredContent.data.navigation.url).toBe('codex://threads/joined-session')
    const collision: any = await f.client.callTool({
      ...request,
      arguments: { ...request.arguments, reference: 'different' },
    })
    expect(collision.isError).toBe(true)
    expect(f.bridge).toHaveBeenCalledTimes(1)
  } finally {
    await f.close()
  }
})

test('ambiguous mutation failures are cached and never automatically retried', async () => {
  const f = await fixture()
  try {
    f.bridge.mockRejectedValue(new Error('disconnected; inspect before retrying'))
    const args = { name: 'delta_join', arguments: { reference: 'opaque', operationId: 'uncertain' } }
    expect((await f.client.callTool(args)).isError).toBe(true)
    expect((await f.client.callTool(args)).isError).toBe(true)
    expect(f.bridge).toHaveBeenCalledTimes(1)
  } finally {
    await f.close()
  }
})

test('read-only fallback preserves durable pending records and never returns transcript or producer secrets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'delta-read-status-'))
  try {
    const state = freshBinding({
      session: 'caller',
      cwd: '/workspace',
      thread: 'thread',
      reference: 'opaque',
      kind: 'own',
      contract: 10,
    })
    stage(state, { sessionUpdate: 'user_message', text: 'PRIVATE_TEST_TRANSCRIPT' })
    await atomicJson(Recording.path(directory, 'caller'), state)
    const ops = new Operations('unused', directory)
    const status = await ops.status('caller')
    expect(status).toMatchObject({ recording: false, pending: 1, thread: 'thread' })
    expect(JSON.stringify(status)).not.toContain('PRIVATE_TEST_TRANSCRIPT')
    expect((await Recording.load(directory, 'caller'))?.state).toEqual(state)
    expect(await readdir(directory)).toEqual(['sessions'])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('share resolves checkout from the exact native thread and refuses mismatch before any mutation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'delta-share-target-'))
  const correct = join(directory, 'correct'),
    wrong = join(directory, 'wrong')
  await run(['git', 'init', correct])
  await run(['git', 'init', wrong])
  await mkdir(join(correct, 'subdir'))
  const ops = new Operations('unused')
  vi.spyOn(ops, 'native').mockResolvedValue({ thread: { cwd: correct } })
  const bridge = vi.spyOn(ops, 'bridge').mockResolvedValue({})
  try {
    await expect(ops.share({ session: 'caller', cwd: wrong, audience: 'private' })).rejects.toThrow(
      'does not match',
    )
    expect(bridge).not.toHaveBeenCalled()
    await ops.share({ session: 'caller', audience: 'private' })
    expect(bridge).toHaveBeenCalledWith('share', { session: 'caller', cwd: correct, audience: 'private' })
    await ops.share({ session: 'caller', cwd: join(correct, 'subdir'), audience: 'private' })
    expect(bridge).toHaveBeenLastCalledWith('share', { session: 'caller', cwd: correct, audience: 'private' })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('presets refuse an overfull config atomically and use native optimistic concurrency', async () => {
  const slots = Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [String(i), { label: 'User', input: 'mine' }]),
  )
  const call = vi.fn().mockResolvedValue({
    config: { tui: { presets: slots } },
    layers: [{ name: { type: 'user', file: '/config.toml' }, config: {}, version: 'version-a' }],
  })
  const close = vi.fn()
  await expect(managePresets('install', { call, close } as unknown as Codex)).rejects.toThrow(
    'Not enough empty',
  )
  expect(call).toHaveBeenCalledTimes(1)
  expect(close).toHaveBeenCalled()
  call
    .mockReset()
    .mockResolvedValueOnce({
      config: {},
      layers: [{ name: { type: 'user', file: '/config.toml' }, config: {}, version: 'version-a' }],
    })
    .mockRejectedValueOnce(new Error('version changed'))
  await expect(managePresets('install', { call, close } as unknown as Codex)).rejects.toThrow(
    'version changed',
  )
  expect(call).toHaveBeenLastCalledWith(
    'config/batchWrite',
    expect.objectContaining({ expectedVersion: 'version-a' }),
  )
})

test('large output is structurally bounded and explicitly marked', () => {
  const result = bounded({ messages: Array.from({ length: 1000 }, () => ({ text: 'x'.repeat(10000) })) })
  expect(result.truncated).toBe(true)
  expect(JSON.stringify(result).length).toBeLessThan(55_000)
})

test('bundled stdio server starts without npm runtime dependencies or bridge side effects', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'delta-mcp-stdio-'))
  const client = new Client({ name: 'package-smoke', version: '1' })
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [resolve('dist/cli.js'), 'mcp'],
        env: { DELTA_CODEX_HOME: directory },
        stderr: 'pipe',
      }),
    )
    expect((await client.listTools()).tools.length).toBeGreaterThan(10)
    const result: any = await client.callTool({ name: 'delta_panel', arguments: {} })
    expect(result.structuredContent.data.session).toBeNull()
    expect((await client.readResource({ uri: PANEL_URI })).contents[0]?.mimeType).toBe(
      'text/html;profile=mcp-app',
    )
    expect(await readdir(directory)).toEqual([])
  } finally {
    await client.close()
    await rm(directory, { recursive: true, force: true })
  }
}, 15_000)
