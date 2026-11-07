import { test, expect } from 'vitest'
import { createServer } from 'node:http'
import { mkdtemp, writeFile, readFile, rm, cp, mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Codex, history } from '../src/codex/rpc.ts'
import { deadline } from '../src/core/process.ts'
import { translate } from '../src/recording/translate.ts'
import { managePresets, PRESETS } from '../src/codex/presets.ts'
import { Recording, freshBinding, stage } from '../src/recording/store.ts'
import { atomicJson } from '../src/core/storage.ts'

// Opt-in because contributors need not have Codex installed. This server is the only model endpoint.
test.skipIf(process.env.DELTA_CODEX_NATIVE_TEST !== '1')(
  'shared Codex daemon preserves injected context, runs a local fixture turn, and exposes recordable history',
  async () => {
    const home = await mkdtemp(join(tmpdir(), 'delta-native-'))
    const requests: any[] = []
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(chunk)
      try {
        requests.push(JSON.parse(Buffer.concat(chunks).toString()))
      } catch {
        response.writeHead(400).end()
        return
      }
      const item = {
        type: 'message',
        id: `msg_${requests.length}`,
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: 'Fixture response from native Codex.', annotations: [] }],
      }
      const base = { id: `resp_${requests.length}`, object: 'response', model: 'gpt-6.1-sol', created_at: 0 }
      const events = [
        { type: 'response.created', response: { ...base, status: 'in_progress', output: [] } },
        {
          type: 'response.output_item.added',
          output_index: 0,
          item: { ...item, status: 'in_progress', content: [] },
        },
        {
          type: 'response.content_part.added',
          item_id: item.id,
          output_index: 0,
          content_index: 0,
          part: { type: 'output_text', text: '', annotations: [] },
        },
        {
          type: 'response.output_text.delta',
          item_id: item.id,
          output_index: 0,
          content_index: 0,
          delta: item.content[0]!.text,
        },
        { type: 'response.output_item.done', output_index: 0, item },
        {
          type: 'response.completed',
          response: {
            ...base,
            status: 'completed',
            output: [item],
            usage: { input_tokens: 10, output_tokens: 8, total_tokens: 18 },
          },
        },
      ]
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.end(
        events
          .map(
            (event, sequence_number) =>
              `event: ${event.type}\ndata: ${JSON.stringify({ ...event, sequence_number })}\n\n`,
          )
          .join(''),
      )
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }
    await writeFile(
      join(home, 'config.toml'),
      `model = "gpt-6.1-sol"\nmodel_provider = "fixture"\n[model_providers.fixture]\nname = "Local test only"\nbase_url = "http://127.0.0.1:${address.port}"\nwire_api = "responses"\nrequires_openai_auth = false\nsupports_websockets = false\n`,
    )
    const rpc = new Codex(undefined, { CODEX_HOME: home })
    try {
      await mkdir(join(home, 'app-server-daemon'))
      await writeFile(
        join(home, 'app-server-daemon', 'settings.json'),
        JSON.stringify({ shutdownGraceSeconds: 0, updater: { autoUpdateEnabled: false } }),
      )
      const daemon = spawnSync('codex', ['app-server', 'daemon', 'start'], {
        env: { ...process.env, CODEX_HOME: home },
        encoding: 'utf8',
        timeout: 30_000,
      })
      expect(daemon.status, daemon.stderr).toBe(0)
      const started = await rpc.call('thread/start', {
        cwd: home,
        sandbox: 'read-only',
        approvalPolicy: 'never',
      })
      const id = started.thread.id
      await rpc.call('thread/inject_items', {
        threadId: id,
        items: [
          {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: '[Delta collaboration context; native fixture]\nA colleague found the failing test.',
              },
            ],
          },
        ],
      })
      expect(requests).toHaveLength(0)
      const finished = new Promise<any>((resolve) =>
        rpc.on('notification', (message) => {
          if (message.method === 'turn/completed') resolve(message.params.turn)
        }),
      )
      await rpc.call('turn/start', {
        threadId: id,
        input: [{ type: 'text', text: 'Reply with the fixture response.' }],
      })
      const turn = await deadline(finished, 20_000, 'Native fixture turn')
      expect(turn.status).toBe('completed')
      expect(JSON.stringify(requests[0])).toContain('A colleague found the failing test.')
      const turns = await history(rpc, id)
      expect(turns).toHaveLength(1)
      const updates = turns.flatMap((t) => t.items.flatMap((i: any) => translate(i)))
      expect(
        updates.some(
          (u) => u.sessionUpdate === 'agent_message' && JSON.stringify(u).includes('Fixture response'),
        ),
      ).toBe(true)
      expect(updates.some((u) => JSON.stringify(u).includes('A colleague found'))).toBe(false)
    } finally {
      await rpc.close()
      const stopped = spawnSync('codex', ['app-server', 'daemon', 'stop'], {
        env: { ...process.env, CODEX_HOME: home },
        encoding: 'utf8',
        timeout: 30_000,
      })
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      // Keep the isolated profile if stopping fails; never remove a running daemon's state.
      if (stopped.status === 0) await rm(home, { recursive: true, force: true })
      expect(stopped.status, stopped.stderr).toBe(0)
    }
  },
  90_000,
)

test.skipIf(process.env.DELTA_CODEX_NATIVE_TEST !== '1').each(['fresh', 'migrated'])(
  '%s Codex installation exposes skills, untrusted hooks and profile-scoped MCP tools with native session metadata',
  async (installation) => {
    const temp = await mkdtemp(join(tmpdir(), 'delta-plugin-install-')),
      home = join(temp, 'codex'),
      root = join(temp, 'plugin')
    await mkdir(home)
    await mkdir(root)
    const rpc = new Codex(['codex', 'app-server', '--listen', 'stdio://'], { CODEX_HOME: home })
    try {
      for (const file of ['.agents', '.codex-plugin', '.mcp.json', 'skills', 'hooks', 'bin', 'dist'])
        await cp(resolve(file), join(root, file), { recursive: true })
      const run = (args: string[]) => {
        const result = spawnSync('codex', args, {
          cwd: home,
          env: { ...process.env, CODEX_HOME: home },
          encoding: 'utf8',
          timeout: 30_000,
        })
        expect(result.status, result.stderr).toBe(0)
        return result.stdout
      }
      const retained = freshBinding({
        session: 'migration-fixture',
        cwd: home,
        thread: 'synthetic-retained-thread',
        reference: 'opaque:retained',
        kind: 'own',
        contract: 10,
      })
      retained.stopped = true
      stage(retained, { sessionUpdate: 'state_update', state: 'idle' })
      const retainedPath = Recording.path(join(home, 'delta'), retained.session)
      await atomicJson(retainedPath, retained)
      const originalState = await readFile(retainedPath, 'utf8')
      if (installation === 'migrated') {
        const legacyRoot = join(temp, 'legacy-plugin')
        await cp(root, legacyRoot, { recursive: true })
        const manifestPath = join(legacyRoot, '.agents', 'plugins', 'marketplace.json')
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
        manifest.name = 'delta-codex-local'
        await atomicJson(manifestPath, manifest)
        run(['plugin', 'marketplace', 'add', legacyRoot])
        run(['plugin', 'add', 'delta-codex@delta-codex-local', '--json'])
        run(['plugin', 'remove', 'delta-codex@delta-codex-local'])
        run(['plugin', 'marketplace', 'remove', 'delta-codex-local'])
      }
      run(['plugin', 'marketplace', 'add', root])
      run(['plugin', 'add', 'delta-codex@delta-codex', '--json'])
      const marketplaces = JSON.parse(run(['plugin', 'marketplace', 'list', '--json'])).marketplaces
      expect(marketplaces.some((entry: any) => entry.name === 'delta-codex')).toBe(true)
      expect(marketplaces.some((entry: any) => entry.name === 'delta-codex-local')).toBe(false)
      expect(await readFile(retainedPath, 'utf8')).toBe(originalState)
      const hooks = await rpc.call('hooks/list', { cwds: [home] })
      expect(hooks.data[0].errors).toEqual([])
      expect(hooks.data[0].hooks).toHaveLength(9)
      expect(hooks.data[0].hooks.every((hook: any) => hook.trustStatus === 'untrusted')).toBe(true)
      const discovered = await rpc.call('plugin/read', {
        marketplacePath: join(root, '.agents', 'plugins', 'marketplace.json'),
        pluginName: 'delta-codex',
      })
      expect(discovered.plugin.skills.map((skill: any) => skill.name).sort()).toEqual([
        'delta-codex:delta',
        'delta-codex:join',
        'delta-codex:setup',
        'delta-codex:share',
        'delta-codex:status',
      ])
      const { thread } = await rpc.call('thread/start', {
        cwd: home,
        sandbox: 'read-only',
        approvalPolicy: 'never',
      })
      const saved = freshBinding({
        session: thread.id,
        cwd: home,
        thread: 'synthetic-thread',
        reference: 'opaque:test',
        kind: 'own',
        contract: 10,
      })
      saved.stopped = true
      saved.visibility = 'private'
      saved.title = 'Native MCP fixture'
      await atomicJson(Recording.path(join(home, 'delta'), thread.id), saved)
      const catalog = await rpc.call('mcpServerStatus/list', { threadId: thread.id })
      const mcp = catalog.data.find((entry: any) => entry.tools?.delta_panel)
      expect(mcp, JSON.stringify(catalog) + (rpc as any).stderr).toBeDefined()
      expect(mcp.tools.delta_panel._meta['openai/ui'].entrypoints).toEqual([
        { type: 'global' },
        { type: 'thread' },
      ])
      expect(mcp.resources.some((r: any) => r.uri === 'ui://delta/workspace.html')).toBe(true)
      const result = await rpc.call('mcpServer/tool/call', {
        threadId: thread.id,
        server: mcp.name,
        tool: 'delta_panel',
        arguments: {},
      })
      expect(result.isError).not.toBe(true)
      expect(result.structuredContent.data).toMatchObject({
        boundSession: thread.id,
        session: { session: thread.id, thread: 'synthetic-thread', stopped: true, visibility: 'private' },
      })
      const refused = await rpc.call('mcpServer/tool/call', {
        threadId: thread.id,
        server: mcp.name,
        tool: 'delta_stop',
        arguments: { session: 'different-session' },
      })
      expect(refused.isError).toBe(true)
    } finally {
      await rpc.close()
      await rm(temp, { recursive: true, force: true })
    }
  },
  60_000,
)

test.skipIf(process.env.DELTA_CODEX_NATIVE_TEST !== '1')(
  'presets use versioned native config edits and preserve occupied and customized slots',
  async () => {
    const home = await mkdtemp(join(tmpdir(), 'delta-presets-'))
    const config = join(home, 'config.toml')
    const rpc = () => new Codex(['codex', 'app-server', '--listen', 'stdio://'], { CODEX_HOME: home })
    try {
      await writeFile(config, '# User comment\n[tui.presets.1]\nlabel = "Mine"\ninput = "Keep me"\n')
      const added = await managePresets('install', rpc())
      expect(added.assigned.map((p) => p.slot)).toEqual(['2', '3', '4'])
      expect((await managePresets('install', rpc())).changed).toBe(0)
      let text = await readFile(config, 'utf8')
      expect(text).toContain('# User comment')
      text = text.replace(PRESETS[0]!.input, 'My customized Delta shortcut')
      await writeFile(config, text)
      expect((await managePresets('remove', rpc())).changed).toBe(2)
      text = await readFile(config, 'utf8')
      expect(text).toContain('My customized Delta shortcut')
      expect(text).toContain('Keep me')
      expect(text).not.toContain('Delta join')
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  },
  30_000,
)
