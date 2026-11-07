import { digest } from '../core/storage.ts'
import { jsonText } from '../core/json.ts'
import { stage, type Binding, type Update } from './store.ts'

export const REMOTE_PREFIX = '[Delta collaboration context'
const text = (value: unknown) => ({ type: 'text', text: jsonText(value) })
const content = (value: unknown) => ({ type: 'content', content: text(value) })

/** Only public conversation items are exported. Hook, system, developer and encrypted reasoning stay local. */
export function translate(item: any, parent?: string): Update[] {
  const id = String(item.id)
  switch (item.type) {
    case 'userMessage': {
      const blocks = (item.content ?? []).map((part: any) => {
        if (part.type === 'text') return text(part.text)
        if (part.type === 'image' && typeof part.url === 'string') {
          const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/.exec(part.url)
          if (match) return { type: 'image', mimeType: match[1], data: match[2] }
        }
        // A path is not permission to read an arbitrary local file. Keep the attachment descriptor.
        return text(part)
      })
      if (blocks.some((b: any) => b.type === 'text' && b.text.startsWith(REMOTE_PREFIX))) return []
      return [
        {
          sessionUpdate: 'user_message',
          messageId: id,
          content: blocks,
          ...(parent ? { _meta: { delta: { sender: { external_id: parent } } } } : {}),
        },
      ]
    }
    case 'agentMessage':
      if (item.text?.startsWith(REMOTE_PREFIX)) return []
      return [{ sessionUpdate: 'agent_message', messageId: id, content: [text(item.text ?? '')] }]
    case 'reasoning': {
      const visible = [...(item.summary ?? []), ...(item.content ?? [])].filter(
        (s: unknown) => typeof s === 'string',
      )
      return visible.length
        ? [{ sessionUpdate: 'agent_thought', messageId: id, content: visible.map(text) }]
        : []
    }
    case 'plan':
      return [{ sessionUpdate: 'agent_message', messageId: id, content: [text(item.text)] }]
    case 'commandExecution':
      return [
        {
          sessionUpdate: 'tool_call_update',
          toolCallId: id,
          title: item.command,
          kind: 'execute',
          status: status(item.status),
          rawInput: { command: item.command, cwd: item.cwd },
          rawOutput: { exitCode: item.exitCode, output: item.aggregatedOutput },
          content: item.aggregatedOutput ? [content(item.aggregatedOutput)] : [],
        },
      ]
    case 'fileChange':
      return [
        {
          sessionUpdate: 'tool_call_update',
          toolCallId: id,
          title: 'Apply patch',
          kind: 'edit',
          status: status(item.status),
          rawInput: item.changes,
          locations: (item.changes ?? []).map((c: any) => ({ path: c.path })),
          content: (item.changes ?? []).map((c: any) => ({
            type: 'diff',
            changes: [
              {
                path: c.path,
                operation: c.kind?.type === 'add' ? 'add' : c.kind?.type === 'delete' ? 'delete' : 'modify',
              },
            ],
            patch: { format: 'git_patch', text: c.diff },
          })),
        },
      ]
    case 'mcpToolCall':
      return [
        {
          sessionUpdate: 'tool_call_update',
          toolCallId: id,
          title: `${item.server}/${item.tool}`,
          kind: 'other',
          status: status(item.status),
          rawInput: item.arguments,
          rawOutput: item.result ?? item.error,
          content: item.result || item.error ? [content(item.result ?? item.error)] : [],
        },
      ]
    case 'dynamicToolCall':
    case 'collabAgentToolCall':
      return [
        {
          sessionUpdate: 'tool_call_update',
          toolCallId: id,
          title: item.tool,
          kind: 'other',
          status: status(item.status),
          rawInput: item.arguments ?? { prompt: item.prompt, receivers: item.receiverThreadIds },
          rawOutput: item.contentItems ?? item.agentsStates,
        },
      ]
    case 'functionCallOutput':
      return [
        {
          sessionUpdate: 'tool_call_update',
          toolCallId: id,
          title: item.name,
          kind: 'other',
          status: 'completed',
          rawOutput: item.output,
          content: [content(item.output)],
        },
      ]
    case 'webSearch':
      return [
        {
          sessionUpdate: 'tool_call_update',
          toolCallId: id,
          title: 'Web search',
          kind: 'search',
          status: 'completed',
          rawInput: item.action ?? item.query,
        },
      ]
    case 'imageView':
      return [
        {
          sessionUpdate: 'tool_call_update',
          toolCallId: id,
          title: 'View image',
          kind: 'read',
          status: 'completed',
          rawInput: { path: item.path },
        },
      ]
    case 'imageGeneration':
      return [
        {
          sessionUpdate: 'tool_call_update',
          toolCallId: id,
          title: 'Generate image',
          kind: 'other',
          status: status(item.status),
          rawOutput: item.result ?? item.revisedPrompt,
        },
      ]
    case 'enteredReviewMode':
    case 'exitedReviewMode':
      return [{ sessionUpdate: 'agent_message', messageId: id, content: [text(item.review)] }]
    // Compaction and hook framing aren't user conversation. Future item types are deliberately skipped.
    default:
      return []
  }
}

function status(value: string) {
  return ['failed', 'declined', 'cancelled'].includes(value)
    ? 'failed'
    : value === 'inProgress'
      ? 'in_progress'
      : 'completed'
}

/** Full replacements under a stable message/tool ID preserve streaming without duplicate bubbles. */
export function recordTurns(state: Binding, turns: any[]) {
  const children = new Set<string>()
  for (const turn of turns) {
    if (turn.status === 'inProgress' && !state.turns[turn.id]) {
      state.turns[turn.id] = {
        sequence: stage(state, { sessionUpdate: 'state_update', state: 'running' }, state.next),
      }
      state.active = turn.id
    }
    const sequence = state.turns[turn.id]?.sequence
    for (const item of turn.items ?? []) {
      if (item.type === 'collabAgentToolCall' && ['spawnAgent', 'spawn_agent'].includes(item.tool))
        for (const child of item.receiverThreadIds ?? []) children.add(child)
      if (item.type === 'subAgentActivity' && item.agentThreadId) children.add(item.agentThreadId)
      const updates = translate(item, state.parent)
      const key = `${turn.id}:${item.id}`,
        fingerprint = digest(updates)
      if (state.seen[key] === fingerprint) continue
      for (const update of updates) stage(state, update, sequence)
      state.seen[key] = fingerprint
    }
    if (turn.status !== 'inProgress' && state.turns[turn.id] && !state.turns[turn.id]!.finished) {
      stage(
        state,
        {
          sessionUpdate: 'state_update',
          state: 'idle',
          stopReason: turn.status === 'completed' ? 'end_turn' : 'cancelled',
        },
        sequence,
      )
      state.turns[turn.id]!.finished = true
      if (state.active === turn.id) delete state.active
    }
  }
  return [...children]
}
