import { test, expect } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Bridge } from '../src/bridge.ts'
import { run } from '../src/core/process.ts'
import { Recording } from '../src/recording/store.ts'
import { cliFixture } from './cli-fixtures.ts'
import { FakeCodex, FakeDelta } from './fakes.ts'

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'delta-bridge-')),
    repo = join(directory, 'repo'),
    data = join(directory, 'state')
  await mkdir(repo)
  await run(['git', 'init', repo])
  const delta = new FakeDelta(repo),
    codex = new FakeCodex(),
    bridge = new Bridge(data, delta, codex)
  codex.threads.set('native', {
    cwd: repo,
    turns: [
      {
        id: 'old',
        status: 'completed',
        items: [
          { type: 'userMessage', id: 'u', content: [{ type: 'text', text: 'Earlier prompt' }] },
          { type: 'agentMessage', id: 'a', text: 'Earlier answer' },
        ],
      },
    ],
  })
  return {
    directory,
    repo,
    data,
    delta,
    codex,
    bridge,
    share: () =>
      bridge.share({ session: 'native', cwd: repo, audience: 'private', organization: 'org_test' }),
    clean: async () => {
      await bridge.close()
      await rm(directory, { recursive: true, force: true })
    },
  }
}
async function until(predicate: () => boolean) {
  for (let n = 0; n < 100; n++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Condition did not settle')
}

test('stopping during a pending share releases the eventual mount and never widens its audience', async () => {
  const f = await fixture()
  let release!: () => void
  let mounting = false
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const mount = f.delta.mount.bind(f.delta)
  f.delta.mount = async (args) => {
    mounting = true
    await gate
    return mount(args)
  }
  const sharing = f.bridge.share({
    session: 'native',
    cwd: f.repo,
    audience: 'organization',
    organization: 'org_test',
  })
  const rejected = expect(sharing).rejects.toThrow('cancelled')
  try {
    await until(() => mounting)
    await f.bridge.stop('native')
    release()
    await rejected
    expect(f.delta.mounts.size).toBe(0)
    expect(f.delta.commands.some((c) => c[1] === 'share')).toBe(false)
  } finally {
    release()
    await sharing.catch(() => {})
    await f.clean()
  }
})
const event = (f: Awaited<ReturnType<typeof fixture>>, name: string, extra = {}) => ({
  hook_event_name: name,
  session_id: 'native',
  cwd: f.repo,
  ...extra,
})

test('sharing imports history, attaches once, persists identity, and does not start a model turn', async () => {
  const f = await fixture()
  try {
    await f.share()
    await f.share()
    const records = f.delta.producers.get('native')!.records.get('native')!
    expect(records.map((r) => r.update.sessionUpdate)).toEqual([
      'session_info_update',
      'user_message',
      'agent_message',
    ])
    expect(f.delta.mounts.size).toBe(1)
    expect(f.codex.calls).not.toContain('turn/start')
    expect((await Recording.load(f.data, 'native'))!.state.pending).toHaveLength(0)
    expect(f.delta.commands.filter((c) => c[0] === 'thread' && c[1] === 'create')).toHaveLength(1)
  } finally {
    await f.clean()
  }
})

test('join uses the opaque reference, a fresh native session and mounts, without sharing or importing the old conversation', async () => {
  const f = await fixture()
  try {
    const thread = f.delta.external()
    f.delta.snapshots = [{ type: 'item', item: cliFixture('item').item }].map((e) => ({
      ...e,
      item: { ...e.item, open: false, content: { text: 'Teammate context' } },
    }))
    const joined = await f.bridge.join(thread.reference)
    expect(joined.session).not.toBe('native')
    expect(joined.resume).toEqual(['codex', '-C', f.repo, 'resume', joined.session])
    expect(f.codex.injected[0]!.text).toContain('Teammate context')
    expect(f.delta.commands.some((c) => ['share', 'create', 'attach'].includes(c[1]!))).toBe(false)
    expect(f.delta.target(thread.reference).records.size).toBe(0)
    expect(f.codex.calls).not.toContain('turn/start')
  } finally {
    await f.clean()
  }
})

test('remote updates wait until idle, then arrive once with edit and removal corrections', async () => {
  const f = await fixture()
  try {
    await f.share()
    await until(() => f.bridge.sessions.get('native')!.view.snapshotDone)
    const emit = f.delta.watchers.get('native')!
    await f.bridge.hook(event(f, 'UserPromptSubmit', { turn_id: 'live' }))
    const item = { ...cliFixture('item').item, id: 'remote', open: false, content: { text: 'First version' } }
    emit({ type: 'item', item })
    await new Promise((resolve) => setTimeout(resolve, 10))
    await (f.bridge as any).inject(f.bridge.sessions.get('native'))
    expect(f.codex.injected).toHaveLength(0)
    await f.bridge.sessions.get('native')!.recording.finish('live')
    await (f.bridge as any).inject(f.bridge.sessions.get('native'))
    expect(f.codex.injected).toHaveLength(1)
    emit({ type: 'item', item })
    await new Promise((resolve) => setTimeout(resolve, 10))
    await (f.bridge as any).inject(f.bridge.sessions.get('native'))
    expect(f.codex.injected).toHaveLength(1)
    emit({ type: 'item', item: { ...item, content: { text: 'Edited version' } } })
    await new Promise((resolve) => setTimeout(resolve, 10))
    await (f.bridge as any).inject(f.bridge.sessions.get('native'))
    expect(f.codex.injected.at(-1)!.text).toContain('Edited version')
    emit({ type: 'remove', id: 'remote' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    await (f.bridge as any).inject(f.bridge.sessions.get('native'))
    expect(f.codex.injected.at(-1)!.text).toContain('removed')
  } finally {
    await f.clean()
  }
})

test('a collaborator takeover interrupts the exact Codex turn and denies late tool calls', async () => {
  const f = await fixture()
  try {
    await f.share()
    await f.bridge.hook(event(f, 'UserPromptSubmit', { turn_id: 'running' }))
    const sequence = f.bridge.sessions.get('native')!.recording.state.turns.running!.sequence
    f.delta.watchers.get('native')!({ type: 'producer.turn', sequence, status: 'superseded' })
    await until(() => f.codex.interrupted.length === 1)
    expect(f.codex.interrupted).toEqual([{ thread: 'native', turn: 'running' }])
    expect(await f.bridge.hook(event(f, 'PreToolUse', { turn_id: 'running' }))).toMatchObject({
      hookSpecificOutput: { permissionDecision: 'deny' },
    })
  } finally {
    await f.clean()
  }
})

test('late sharing discovers an already completed native subagent', async () => {
  const f = await fixture()
  try {
    f.codex.threads.get('native')!.turns[0].items.push({
      type: 'collabAgentToolCall',
      id: 'spawn',
      tool: 'spawnAgent',
      receiverThreadIds: ['finished-child'],
      status: 'completed',
    })
    f.codex.threads.set('finished-child', {
      cwd: f.repo,
      turns: [
        {
          id: 'child-turn',
          status: 'completed',
          items: [{ type: 'agentMessage', id: 'child-answer', text: 'Found the issue' }],
        },
      ],
    })
    await f.share()
    const child = f.delta.producers.get('finished-child')!
    expect(child.reference).toBe('thread_native#s=finished-child')
    expect(child.records.get('finished-child')![0]!.update.content).toEqual([
      { type: 'text', text: 'Found the issue' },
    ])
    expect(f.delta.commands.find((c) => c.includes('--parent'))).toContain('--shared-worktrees')
    expect(f.codex.calls).not.toContain('turn/start')
  } finally {
    await f.clean()
  }
})

test('invalid settings never enable automatic sharing', async () => {
  const f = await fixture()
  try {
    await mkdir(join(f.repo, '.delta'))
    await writeFile(join(f.repo, '.delta', 'settings.json'), '{"threads":{"mode":"organization"}}')
    expect(await f.bridge.hook(event(f, 'SessionStart'))).toHaveProperty('systemMessage')
    expect(f.delta.commands).toEqual([])
  } finally {
    await f.clean()
  }
})

test('recovery never discards changes unless the preservation fork succeeded', async () => {
  const f = await fixture()
  try {
    await f.share()
    f.delta.forkFails = true
    await expect(f.bridge.recover('native', 'fork')).rejects.toThrow('fork refused')
    expect(f.delta.commands.some((c) => c[1] === 'discard')).toBe(false)
    f.delta.forkFails = false
    expect(await f.bridge.recover('native', 'fork')).toHaveProperty('keptThread', 'thread_kept')
    expect(f.delta.commands.findIndex((c) => c[1] === 'discard')).toBeGreaterThan(
      f.delta.commands.findIndex((c) => c[1] === 'fork'),
    )
  } finally {
    await f.clean()
  }
})

test('plan updates require contract 10 and retain the live turn sequence', async () => {
  const f = await fixture()
  try {
    f.delta.version = 10
    await f.share()
    await f.bridge.hook(event(f, 'UserPromptSubmit', { turn_id: 'plan-turn' }))
    await f.bridge.hook(
      event(f, 'PostToolUse', {
        turn_id: 'plan-turn',
        tool_name: 'update_plan',
        tool_input: { plan: [{ step: 'Inspect', status: 'in_progress' }] },
      }),
    )
    const turnSequence = f.bridge.sessions.get('native')!.recording.state.turns['plan-turn']!.sequence
    expect(f.bridge.sessions.get('native')!.recording.state.pending.at(-1)).toMatchObject({
      turnSequence,
      update: {
        sessionUpdate: 'plan_update',
        plan: {
          type: 'items',
          planId: 'plan',
          entries: [{ content: 'Inspect', status: 'in_progress', priority: 'medium' }],
        },
      },
    })
  } finally {
    await f.clean()
  }
})

test('background runs are asynchronous, accept steering, and never auto-approve a tool', async () => {
  const f = await fixture()
  try {
    await f.share()
    const remote = f.delta.external()
    const result = await f.bridge.runThread('native', remote.reference, 'Inspect this thread')
    expect(result.status).toBe('inProgress')
    expect(await f.bridge.send(result.session, result.turn, 'Also inspect the tests')).toEqual({
      turnId: result.turn,
    })
    const request = {
      id: 44,
      method: 'item/commandExecution/requestApproval',
      params: { threadId: result.session, command: 'run tests' },
    }
    f.codex.requests.set('44', request)
    f.codex.emit('request', request)
    expect(f.codex.answers).toEqual([])
    expect(f.bridge.pending(result.session)).toHaveLength(1)
    expect((await f.bridge.wait(result.session, 0)).pending).toHaveLength(1)
    f.bridge.answer('44', 'decline')
    expect(f.codex.answers).toEqual([{ decision: 'decline' }])
    await f.bridge.interrupt(result.session, result.turn)
    expect(f.codex.interrupted).toContainEqual({ thread: result.session, turn: result.turn })
  } finally {
    await f.clean()
  }
})

test('a read-only parent cannot launch a writable child', async () => {
  const f = await fixture()
  try {
    await f.share()
    const remote = f.delta.external()
    f.codex.sandbox = 'readOnly'
    await expect(f.bridge.runThread('native', remote.reference, 'Edit the file', true)).rejects.toThrow(
      'cannot gain write access',
    )
    expect(f.codex.calls).not.toContain('turn/start')
  } finally {
    await f.clean()
  }
})

test('custom permission profiles cannot silently become ordinary workspace permissions', async () => {
  const f = await fixture()
  try {
    await f.share()
    const remote = f.delta.external()
    f.codex.profile = 'restricted-company-profile'
    await expect(f.bridge.runThread('native', remote.reference, 'Inspect', true)).rejects.toThrow(
      'custom permission policy',
    )
    expect(f.codex.calls).not.toContain('turn/start')
  } finally {
    await f.clean()
  }
})

test('writable runs limit writes to mounted checkouts, disable network and preserve literal slash prompts', async () => {
  const f = await fixture()
  try {
    await f.share()
    const remote = f.delta.external()
    await f.bridge.runThread('native', remote.reference, '/review this text literally', true)
    const call = f.codex.parameters.find((p) => p.method === 'turn/start')!
    expect(call.params.input).toEqual([{ type: 'text', text: '/review this text literally' }])
    expect(call.params.sandboxPolicy).toEqual({
      type: 'workspaceWrite',
      writableRoots: [f.repo],
      networkAccess: false,
      excludeTmpdirEnvVar: true,
      excludeSlashTmp: true,
    })
  } finally {
    await f.clean()
  }
})

test('isolated branches request Delta-owned worktrees with an opaque reference', async () => {
  const f = await fixture()
  try {
    await f.share()
    const child = await f.bridge.branch('native', 'Independent review', true)
    expect(child.reference).toContain('#s=')
    expect(f.delta.commands.at(-1)).toContain('--isolated-worktrees')
  } finally {
    await f.clean()
  }
})

test('an explicit stop survives an automatic-sync policy and a resumed session', async () => {
  const f = await fixture()
  try {
    await f.share()
    await f.bridge.setup(f.repo, { mode: 'organization', organization: 'org_test' })
    await f.bridge.stop('native')
    await f.bridge.hook(event(f, 'SessionStart', { source: 'resume' }))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(f.bridge.status('native')).toEqual({ session: 'native', recording: false })
  } finally {
    await f.clean()
  }
})
