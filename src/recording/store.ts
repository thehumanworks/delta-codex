import { join } from 'node:path'
import { atomicJson, readJson, digest, Serial } from '../core/storage.ts'
import type { Ledger } from '../watch/conversation.ts'
import type { Delta } from '../cli/delta.ts'
import {
  appendFailure,
  classifyCommandFailure,
  commandErrorFromOutput,
  parseAppendReceipt,
  validateThreadFrontier,
  DeltaCommandError,
} from '../cli/thread-commands.ts'

export type Update = Record<string, unknown> & { sessionUpdate: string }
export type RecordEntry = { schemaVersion: 1; sequence: number; turnSequence?: number; update: Update }
export type Turn = { sequence?: number; finished?: boolean; superseded?: boolean }
export type Binding = {
  version: 1
  session: string
  cwd: string
  thread: string
  reference: string
  url?: string
  kind: 'own' | 'join' | 'child'
  parent?: string
  organization?: string
  visibility?: string
  owner?: string
  worktree?: string
  contract: number
  next: number
  pending: RecordEntry[]
  seen: Record<string, string>
  turns: Record<string, Turn>
  ledger: Ledger
  active?: string
  paused?: string
  retryAt?: number
  failures: number
  stopped?: boolean
  created: string
  fork?: string
  injected?: Record<string, string>
  title?: string
}

export function freshBinding(
  input: Pick<Binding, 'session' | 'cwd' | 'thread' | 'reference' | 'kind' | 'contract'>,
): Binding {
  return {
    ...input,
    version: 1,
    next: 1,
    pending: [],
    seen: {},
    turns: {},
    ledger: { thread: input.thread, items: {} },
    failures: 0,
    created: new Date().toISOString(),
  }
}

export function stage(state: Binding, update: Update, turnSequence?: number) {
  if (!Number.isSafeInteger(state.next) || state.next < 1 || state.next >= Number.MAX_SAFE_INTEGER)
    throw new Error('Invalid sequence frontier')
  const record: RecordEntry = {
    schemaVersion: 1,
    sequence: state.next++,
    ...(turnSequence ? { turnSequence } : {}),
    update,
  }
  state.pending.push(record)
  return record.sequence
}

/** One durable file owns sequence allocation, content fingerprints, and the unacknowledged records. */
export class Recording {
  readonly serial = new Serial()
  constructor(
    readonly path: string,
    public state: Binding,
  ) {}
  static path(directory: string, session: string) {
    return join(directory, 'sessions', digest(session) + '.json')
  }
  static async load(directory: string, session: string) {
    const path = this.path(directory, session),
      value = await readJson<Binding>(path)
    if (!value) return undefined
    validateBinding(value, session)
    return new Recording(path, value)
  }
  async change<T>(fn: (draft: Binding) => T | Promise<T>): Promise<T> {
    return this.serial.run(async () => {
      const draft = structuredClone(this.state),
        result = await fn(draft)
      await atomicJson(this.path, draft)
      this.state = draft
      return result
    })
  }
  async reconcile(delta: Delta) {
    const state = await delta.status(this.state.reference, this.state.session)
    validateThreadFrontier(state, this.state)
    return state
  }
  async begin(turn: string) {
    await this.change((state) => {
      if (state.turns[turn]?.superseded)
        throw new Error('This turn was taken over in Delta. Send a new prompt to take another turn.')
      if (!state.turns[turn])
        state.turns[turn] = {
          sequence: stage(state, { sessionUpdate: 'state_update', state: 'running' }, state.next),
        }
      state.active = turn
    })
  }
  async finish(turn: string, reason = 'end_turn') {
    await this.change((state) => {
      const saved = state.turns[turn]
      if (saved && !saved.finished) {
        stage(state, { sessionUpdate: 'state_update', state: 'idle', stopReason: reason }, saved.sequence)
        saved.finished = true
      }
      if (state.active === turn) delete state.active
    })
  }

  /** Valid receipts can precede a failed batch. Persist only that acknowledged prefix. */
  async drain(delta: Delta, onFenced: (turn: string) => Promise<void>) {
    const fenced: string[] = []
    await this.serial.run(async () => {
      const state = structuredClone(this.state)
      if (!state.pending.length || state.paused || (state.retryAt ?? 0) > Date.now()) return
      let bytes = 0
      const batch: RecordEntry[] = []
      for (const record of state.pending) {
        const size = Buffer.byteLength(JSON.stringify(record))
        if (batch.length && (bytes + size > 1024 * 1024 || batch.length >= 128)) break
        bytes += size
        batch.push(record)
      }
      let failure: unknown
      try {
        const result = await delta.append(
          state.reference,
          state.session,
          state.kind !== 'join',
          batch.map((r) => JSON.stringify(r)).join('\n') + '\n',
        )
        const lines = result.stdout.trim().split('\n').filter(Boolean)
        let count = 0
        for (const line of lines) {
          if (count >= batch.length)
            throw new DeltaCommandError('invalid_acknowledgment', 'Unexpected extra append receipt')
          const record = batch[count]!
          let receipt
          try {
            receipt = parseAppendReceipt(line, state.thread, record.sequence)
          } catch {
            throw (
              commandErrorFromOutput(line) ??
              new DeltaCommandError('invalid_acknowledgment', 'Malformed append receipt; no delivery assumed')
            )
          }
          if (receipt.turn_sequence !== (record.turnSequence ?? null))
            throw new DeltaCommandError('invalid_acknowledgment', 'Append receipt names a different turn')
          if (receipt.disposition === 'fenced') {
            for (const [id, turn] of Object.entries(state.turns))
              if (turn.sequence === record.turnSequence && !turn.superseded) {
                turn.superseded = true
                fenced.push(id)
              }
          }
          state.pending.shift()
          count++
        }
        if (result.code !== 0 || count !== batch.length)
          throw appendFailure(result.stdout, result.stderr, result.code)
        state.failures = 0
        delete state.retryAt
      } catch (error) {
        failure = error
      }
      if (failure) {
        const message = failure instanceof Error ? failure.message : String(failure)
        if (classifyCommandFailure(failure) === 'transient') {
          state.failures++
          const delay = failure instanceof DeltaCommandError ? failure.hints.retryAfterMs : undefined
          state.retryAt =
            Date.now() + Math.max(delay ?? 0, Math.min(60_000, 500 * 2 ** Math.min(state.failures, 7)))
        } else state.paused = message
      }
      await atomicJson(this.path, state)
      this.state = state
    })
    for (const turn of fenced) await onFenced(turn)
  }
}

function validateBinding(value: Binding, session: string) {
  if (
    value.version !== 1 ||
    value.session !== session ||
    typeof value.thread !== 'string' ||
    typeof value.reference !== 'string' ||
    !Number.isSafeInteger(value.next) ||
    value.next < 1 ||
    !Array.isArray(value.pending) ||
    !value.seen ||
    !value.turns ||
    !value.ledger
  )
    throw new Error(
      'Invalid saved Delta state. Preserve it for recovery; do not reset this session’s sequence.',
    )
  let previous = value.pending[0]?.sequence ?? value.next
  for (const record of value.pending) {
    if (
      record.schemaVersion !== 1 ||
      record.sequence !== previous++ ||
      record.sequence >= value.next ||
      !record.update?.sessionUpdate
    )
      throw new Error('Corrupt Delta outbox. Preserve it for recovery; start a new Codex session.')
  }
  if (previous !== value.next) throw new Error('Delta outbox has a sequence gap')
}
