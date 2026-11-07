import { test, expect } from 'vitest'
import { createServer } from 'node:http'
import { mkdtemp, writeFile, rm, cp, mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Codex, history } from '../src/codex/rpc.ts'
import { deadline } from '../src/core/process.ts'
import { translate } from '../src/recording/translate.ts'

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

test.skipIf(process.env.DELTA_CODEX_NATIVE_TEST !== '1')(
  'Codex installs the release layout and discovers all nine untrusted hooks',
  async () => {
    const temp = await mkdtemp(join(tmpdir(), 'delta-plugin-install-')),
      home = join(temp, 'codex'),
      root = join(temp, 'plugin')
    await mkdir(home)
    await mkdir(root)
    const rpc = new Codex(['codex', 'app-server', '--listen', 'stdio://'], { CODEX_HOME: home })
    try {
      for (const file of ['.agents', '.codex-plugin', 'skills', 'hooks', 'bin', 'dist'])
        await cp(resolve(file), join(root, file), { recursive: true })
      for (const args of [
        ['plugin', 'marketplace', 'add', root],
        ['plugin', 'add', 'delta-codex@delta-codex-local', '--json'],
      ]) {
        const result = spawnSync('codex', args, {
          cwd: home,
          env: { ...process.env, CODEX_HOME: home },
          encoding: 'utf8',
        })
        expect(result.status, result.stderr).toBe(0)
      }
      const hooks = await rpc.call('hooks/list', { cwds: [home] })
      expect(hooks.data[0].errors).toEqual([])
      expect(hooks.data[0].hooks).toHaveLength(9)
      expect(hooks.data[0].hooks.every((hook: any) => hook.trustStatus === 'untrusted')).toBe(true)
      const discovered = await rpc.call('plugin/read', {
        marketplacePath: join(root, '.agents', 'plugins', 'marketplace.json'),
        pluginName: 'delta-codex',
      })
      expect(discovered.plugin.skills[0].name).toBe('delta-codex:delta')
    } finally {
      await rpc.close()
      await rm(temp, { recursive: true, force: true })
    }
  },
  30_000,
)
