import { Delta } from '../src/cli/delta.ts'
import { cliFixture } from './cli-fixtures.ts'
import type { Stream } from '../src/core/process.ts'
import type { RecordEntry } from '../src/recording/store.ts'
import { Codex } from '../src/codex/rpc.ts'

export class FakeCodex extends Codex {
  threads = new Map<string, { cwd: string; turns: any[]; name?: string }>()
  injected: { thread: string; text: string }[] = []
  interrupted: { thread: string; turn: string }[] = []
  calls: string[] = []
  parameters: { method: string; params: any }[] = []
  sandbox = 'workspaceWrite'
  profile?: string
  answers: unknown[] = []
  override respond(id: string, value?: unknown) {
    this.answers.push(value)
    this.requests.delete(id)
  }
  override async call(method: string, params: any): Promise<any> {
    this.calls.push(method)
    this.parameters.push({ method, params })
    const thread = this.threads.get(params.threadId)
    switch (method) {
      case 'thread/loaded/list':
        return { data: [...this.threads.keys()] }
      case 'thread/read':
        if (!thread) throw new Error('Unknown Codex thread')
        return { thread: { id: params.threadId, ...structuredClone(thread) } }
      case 'thread/resume':
        return {
          thread: { id: params.threadId, ...structuredClone(thread) },
          sandbox: { type: this.sandbox },
          activePermissionProfile: this.profile ? { id: this.profile } : null,
          approvalPolicy: 'on-request',
          model: 'fixture-model',
        }
      case 'thread/turns/list':
        if (!thread) throw new Error('Unknown Codex thread')
        return {
          data: structuredClone(thread.turns).map((t) => ({ ...t, itemsView: 'full' })),
          nextCursor: null,
        }
      case 'thread/start': {
        const id = `joined-${this.threads.size}`
        this.threads.set(id, { cwd: params.cwd, turns: [] })
        return { thread: { id } }
      }
      case 'thread/inject_items':
        if (!thread) throw new Error('Unknown Codex thread')
        this.injected.push({ thread: params.threadId, text: params.items[0].content[0].text })
        return {}
      case 'turn/interrupt':
        this.interrupted.push({ thread: params.threadId, turn: params.turnId })
        return {}
      case 'turn/start': {
        const turn = {
          id: 'background-turn',
          status: 'inProgress',
          items: [{ type: 'userMessage', id: 'background-prompt', content: params.input }],
        }
        thread!.turns.push(turn)
        return { turn }
      }
      case 'turn/steer':
        return { turnId: params.expectedTurnId }
      default:
        throw new Error(`Unexpected Codex RPC: ${method}`)
    }
  }
}

type Thread = {
  id: string
  reference: string
  visibility: string
  directory: string
  records: Map<string, RecordEntry[]>
  worktree?: string
}
export class FakeDelta extends Delta {
  threads = new Map<string, Thread>()
  producers = new Map<string, Thread>()
  commands: string[][] = []
  watchers = new Map<string, (event: unknown) => void>()
  mounts = new Set<Stream>()
  snapshots: unknown[] = []
  version = 8
  stoppedMounts = 0
  forkFails = false
  constructor(readonly directory: string) {
    super('fake')
  }
  override async contract() {
    return this.version
  }
  target(reference: string) {
    const thread = [...this.threads.values()].find(
      (t) =>
        t.reference === reference || t.id === reference || reference === `https://delta.dev/join/${t.id}`,
    )
    if (!thread) throw new Error(`Unknown Delta reference: ${reference}`)
    return thread
  }
  external(id = 'remote', reference = 'thread_remote#s=opaque/value') {
    const thread: Thread = {
      id,
      reference,
      visibility: 'organization',
      directory: this.directory,
      records: new Map(),
      worktree: 'worktree',
    }
    this.threads.set(id, thread)
    return thread
  }
  override async command(args: string[]): Promise<any> {
    this.commands.push(args)
    const option = (name: string) => args[args.indexOf(name) + 1]
    const [kind, op, ref] = args
    if (kind === 'thread' && op === 'create') {
      const id = option('--external-id')!,
        existing = this.producers.get(id)
      if (existing)
        return { operation: 'created', created: false, thread_id: existing.id, reference: existing.reference }
      const thread: Thread = {
        id: `thread_${id}`,
        reference: args.includes('--parent') ? `${option('--parent')}#s=${id}` : `thread_${id}`,
        visibility: 'private',
        directory: this.directory,
        records: new Map(),
      }
      this.producers.set(id, thread)
      this.threads.set(thread.id, thread)
      return { operation: 'created', created: true, thread_id: thread.id, reference: thread.reference }
    }
    if (kind === 'worktree' && op === 'list')
      return {
        worktrees: [...this.threads.values()]
          .filter((t) => t.worktree)
          .map((t) => ({ reference: t.worktree, directories: [{ directory: t.directory }] })),
      }
    if (kind === 'worktree' && op === 'create')
      return { operation: 'created', worktree_id: 'worktree', reference: 'worktree' }
    if (kind === 'worktree' && op === 'attach') {
      this.target(option('--thread')!).worktree = ref
      return { operation: 'attached', reference: ref, thread_id: this.target(option('--thread')!).id }
    }
    if (kind === 'thread' && op === 'share') {
      const thread = this.target(ref!)
      thread.visibility = 'organization'
      return { operation: 'shared', url: `https://delta.dev/join/${thread.id}`, thread_id: thread.id }
    }
    if (kind === 'thread' && op === 'invite')
      return {
        results: args
          .slice(args.indexOf('--') + 1)
          .map((email) => ({ email, success: !email.startsWith('fail') })),
      }
    if (kind === 'thread' && op === 'fork') {
      if (this.forkFails) throw new Error('fork refused')
      return { thread_id: 'thread_kept' }
    }
    if (kind === 'thread' && op === 'discard') return { operation: 'discarded' }
    throw new Error(`Unexpected Delta command: ${args.join(' ')}`)
  }
  override async status(reference: string, session: string): Promise<any> {
    const thread = this.target(reference),
      records = thread.records.get(session) ?? []
    return cliFixture('status', {
      thread_id: thread.id,
      visibility: thread.visibility,
      url: `https://delta.dev/join/${thread.id}`,
      producer: { source: 'codex', external_id: session, next_sequence: records.length + 1, turn: null },
      worktrees: {
        status: 'available',
        items: thread.worktree
          ? [
              {
                reference: thread.worktree,
                checkouts: [{ directory: thread.directory, state: 'attached', active: true }],
              },
            ]
          : [],
      },
    })
  }
  override async append(reference: string, session: string, _local: boolean, input: string) {
    const thread = this.target(reference),
      records = thread.records.get(session) ?? []
    thread.records.set(session, records)
    const receipts: string[] = []
    for (const line of input.trim().split('\n')) {
      const record = JSON.parse(line),
        duplicate = record.sequence <= records.length
      if (!duplicate) {
        if (record.sequence !== records.length + 1) throw new Error('Sequence gap')
        records.push(record)
      } else if (JSON.stringify(records[record.sequence - 1]) !== line)
        throw new Error('Sequence reused with different content')
      receipts.push(
        JSON.stringify(
          cliFixture('recorded', {
            thread_id: thread.id,
            sequence: record.sequence,
            next_sequence: records.length + 1,
            duplicate,
            disposition: duplicate ? 'duplicate' : 'recorded',
            turn_sequence: record.turnSequence ?? null,
          }),
        ),
      )
    }
    return { code: 0, stdout: receipts.join('\n'), stderr: '' }
  }
  override watch(reference: string, session: string, onLine: (line: string) => void): Stream {
    let end!: () => void
    const done = new Promise<void>((resolve) => {
      end = resolve
    })
    const emit = (event: unknown) => onLine(JSON.stringify(event))
    this.watchers.set(session, emit)
    setTimeout(() => {
      emit({ type: 'ready', thread_id: this.target(reference).id, producer: null })
      for (const event of this.snapshots) emit(event)
      emit({ type: 'live' })
    }, 0)
    return {
      ready: Promise.resolve({}),
      done,
      stop: async () => {
        if (this.watchers.get(session) === emit) this.watchers.delete(session)
        end()
      },
    }
  }
  override async mount(args: string[]) {
    let end!: () => void
    const done = new Promise<void>((resolve) => {
      end = resolve
    })
    const process: Stream = {
      done,
      ready: Promise.resolve({}),
      stop: async () => {
        if (this.mounts.delete(process)) this.stoppedMounts++
        end()
      },
    }
    this.mounts.add(process)
    const value =
      args[0] === 'thread'
        ? cliFixture('mount', {
            thread_id: this.target(args[2]!).id,
            owner: args[args.indexOf('--owner') + 1],
            directory: this.directory,
            worktrees: [
              { reference: 'worktree', name: 'project', directory: this.directory, state: 'mounted' },
            ],
          })
        : { operation: 'mounted', reference: args[2], directory: args[3] }
    return { value, process }
  }
}
