import { test, expect } from 'vitest'
import { translate, recordTurns, REMOTE_PREFIX } from '../src/recording/translate.ts'
import { freshBinding } from '../src/recording/store.ts'

test('messages, visible reasoning, images, shell results and patches become ACP updates', () => {
  expect(
    translate({
      type: 'userMessage',
      id: 'u',
      content: [{ type: 'image', url: 'data:image/png;base64,YQ==' }],
    })[0]!.content,
  ).toEqual([{ type: 'image', mimeType: 'image/png', data: 'YQ==' }])
  expect(translate({ type: 'reasoning', id: 'r', summary: ['Visible'], encryptedContent: 'SECRET' })).toEqual(
    [{ sessionUpdate: 'agent_thought', messageId: 'r', content: [{ type: 'text', text: 'Visible' }] }],
  )
  const shell = translate({
    type: 'commandExecution',
    id: 'c',
    command: 'pwd',
    cwd: '/repo',
    status: 'completed',
    aggregatedOutput: '/repo',
    exitCode: 0,
  })[0]!
  expect(shell.kind).toBe('execute')
  expect(shell.rawOutput).toEqual({ exitCode: 0, output: '/repo' })
  const patch = translate({
    type: 'fileChange',
    id: 'f',
    status: 'completed',
    changes: [{ path: '/repo/a', kind: { type: 'add' }, diff: '+hello' }],
  })[0]!
  expect(patch.content).toEqual([
    {
      type: 'diff',
      changes: [{ path: '/repo/a', operation: 'add' }],
      patch: { format: 'git_patch', text: '+hello' },
    },
  ])
})

test('injected collaboration data and hook instructions are not exported back to Delta', () => {
  for (const type of ['hookPrompt', 'contextCompaction', 'developerMessage', 'unknownFutureItem'])
    expect(translate({ type, id: 'x', text: 'PRIVATE' })).toEqual([])
  expect(
    translate({
      type: 'userMessage',
      id: 'x',
      content: [{ type: 'text', text: `${REMOTE_PREFIX}]\nImported message` }],
    }),
  ).toEqual([])
})

test('late share exports completed subagent IDs and history without claiming old turns', () => {
  const state = freshBinding({
    session: 's',
    cwd: '/repo',
    thread: 't',
    reference: 't',
    kind: 'own',
    contract: 8,
  })
  const turns = [
    {
      id: 'turn',
      status: 'completed',
      items: [
        { type: 'agentMessage', id: 'a', text: 'Before compaction' },
        {
          type: 'collabAgentToolCall',
          id: 'c',
          tool: 'spawnAgent',
          receiverThreadIds: ['child-finished'],
          status: 'completed',
        },
      ],
    },
  ]
  expect(recordTurns(state, turns)).toEqual(['child-finished'])
  expect(state.pending.every((r) => r.turnSequence === undefined)).toBe(true)
  const count = state.pending.length
  recordTurns(state, turns)
  expect(state.pending).toHaveLength(count)
  turns[0]!.items[0]!.text = 'Updated'
  recordTurns(state, turns)
  expect(state.pending).toHaveLength(count + 1)
  expect(state.pending.at(-1)!.update.messageId).toBe('a')
})

test('child prompts identify their parent producer', () => {
  const value = translate(
    { type: 'userMessage', id: 'u', content: [{ type: 'text', text: 'Inspect' }] },
    'parent',
  )[0]!
  expect(value._meta).toEqual({ delta: { sender: { external_id: 'parent' } } })
})
