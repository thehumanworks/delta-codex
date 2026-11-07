import { test, expect } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Recording, freshBinding, stage } from '../src/recording/store.ts'
import { Delta } from '../src/cli/delta.ts'

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'delta-outbox-'))
  const recording = new Recording(
    Recording.path(directory, 'session'),
    freshBinding({
      session: 'session',
      cwd: '/repo',
      thread: 'thread_test',
      reference: 'thread_test',
      kind: 'own',
      contract: 8,
    }),
  )
  await recording.change((s) => {
    stage(s, { sessionUpdate: 'user_message', messageId: 'a', content: [{ type: 'text', text: 'Hello' }] })
    stage(s, { sessionUpdate: 'agent_message', messageId: 'b', content: [{ type: 'text', text: 'Hi' }] })
  })
  return { directory, recording, clean: () => rm(directory, { recursive: true, force: true }) }
}
const receipt = (sequence: number, extra = {}) =>
  JSON.stringify({
    operation: 'appended',
    thread_id: 'thread_test',
    sequence,
    next_sequence: sequence + 1,
    duplicate: false,
    disposition: 'recorded',
    turn_sequence: null,
    version: 'actor.1',
    ...extra,
  })

test('partial batches retire only confirmed records and retry identical content after restart', async () => {
  const f = await fixture()
  const sent: string[] = []
  try {
    const delta = new Delta('fake', async (_argv, options) => {
      sent.push(options!.input!)
      return sent.length === 1
        ? {
            code: 1,
            stdout:
              receipt(1) +
              '\n' +
              JSON.stringify({
                error: { code: 'offline', message: 'Offline', retryable: true, retry_after_ms: 5000 },
              }),
            stderr: '',
          }
        : { code: 0, stdout: receipt(2, { duplicate: true, disposition: 'duplicate' }), stderr: '' }
    })
    await f.recording.drain(delta, async () => {})
    expect(f.recording.state.pending.map((r) => r.sequence)).toEqual([2])
    expect(f.recording.state.retryAt).toBeGreaterThan(Date.now() + 4000)
    const resumed = (await Recording.load(f.directory, 'session'))!
    await resumed.change((s) => {
      delete s.retryAt
    })
    await resumed.drain(delta, async () => {})
    expect(sent[1]).toBe(sent[0]!.split('\n')[1] + '\n')
    expect(resumed.state.pending).toEqual([])
    expect(resumed.state.next).toBe(3)
  } finally {
    await f.clean()
  }
})

test('lost receipts keep the exact batch and duplicate receipts safely finish delivery', async () => {
  const f = await fixture()
  const sent: string[] = []
  try {
    const delta = new Delta('fake', async (_argv, options) => {
      sent.push(options!.input!)
      if (sent.length === 1) throw new Error('Connection dropped after commit')
      return {
        code: 0,
        stdout: [1, 2].map((n) => receipt(n, { duplicate: true, disposition: 'duplicate' })).join('\n'),
        stderr: '',
      }
    })
    await f.recording.drain(delta, async () => {})
    expect(f.recording.state.pending).toHaveLength(2)
    await f.recording.change((s) => {
      delete s.retryAt
    })
    await f.recording.drain(delta, async () => {})
    expect(sent[1]).toBe(sent[0])
    expect(f.recording.state.pending).toHaveLength(0)
  } finally {
    await f.clean()
  }
})

test('malformed or mismatched acknowledgments pause instead of deleting records', async () => {
  const f = await fixture()
  try {
    await f.recording.drain(
      new Delta('fake', async () => ({ code: 0, stdout: receipt(1, { thread_id: 'wrong' }), stderr: '' })),
      async () => {},
    )
    expect(f.recording.state.pending).toHaveLength(2)
    expect(f.recording.state.paused).toContain('Malformed')
  } finally {
    await f.clean()
  }
})

test('fencing cancels the matching turn and late output retains its original sequence', async () => {
  const f = await fixture()
  const stopped: string[] = []
  try {
    await f.recording.change((s) => {
      s.pending = []
      s.next = 1
    })
    await f.recording.begin('turn-old')
    await f.recording.change((s) => {
      stage(
        s,
        { sessionUpdate: 'agent_message', messageId: 'late', content: [] },
        s.turns['turn-old']!.sequence,
      )
    })
    const delta = new Delta('fake', async () => ({
      code: 0,
      stdout: [1, 2].map((n) => receipt(n, { disposition: 'fenced', turn_sequence: 1 })).join('\n'),
      stderr: '',
    }))
    await f.recording.drain(delta, async (turn) => {
      stopped.push(turn)
    })
    expect(stopped).toEqual(['turn-old'])
    expect(f.recording.state.turns['turn-old']!.superseded).toBe(true)
    await f.recording.finish('turn-old', 'cancelled')
    expect(f.recording.state.pending[0]!.turnSequence).toBe(1)
  } finally {
    await f.clean()
  }
})

test('concurrent staging never allocates a sequence twice', async () => {
  const f = await fixture()
  try {
    await Promise.all(
      Array.from({ length: 80 }, (_, n) =>
        f.recording.change((s) =>
          stage(s, { sessionUpdate: 'agent_message', messageId: String(n), content: [] }),
        ),
      ),
    )
    const loaded = (await Recording.load(f.directory, 'session'))!
    expect(loaded.state.pending.map((r) => r.sequence)).toEqual(Array.from({ length: 82 }, (_, n) => n + 1))
  } finally {
    await f.clean()
  }
})

test('disk failure leaves in-memory state unchanged and does not deliver unpersisted records', async () => {
  const f = await fixture()
  try {
    const old = structuredClone(f.recording.state)
    const wrong = new Recording(join(f.directory, 'block', 'state'), old)
    await import('node:fs/promises').then((fs) => fs.writeFile(join(f.directory, 'block'), 'not a directory'))
    await expect(
      wrong.change((s) => {
        stage(s, { sessionUpdate: 'state_update', state: 'idle' })
      }),
    ).rejects.toThrow()
    expect(wrong.state).toEqual(old)
  } finally {
    await f.clean()
  }
})

test('a restored Delta store behind acknowledged history fails closed', async () => {
  const f = await fixture()
  try {
    const delta = new Delta()
    delta.status = async () =>
      ({
        thread_id: 'thread_test',
        producer: { source: 'codex', external_id: 'session', next_sequence: 0 },
      }) as any
    await expect(f.recording.reconcile(delta)).rejects.toThrow('lost acknowledged')
  } finally {
    await f.clean()
  }
})
