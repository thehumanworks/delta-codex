import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Delta } from './cli/delta.ts'
import { Codex } from './codex/rpc.ts'
import { managePresets } from './codex/presets.ts'
import { dataDirectory, readJson } from './core/storage.ts'
import { ensureBridge, request } from './ipc.ts'
import { Recording, type Binding } from './recording/store.ts'
import { repository } from './settings.ts'

export type SessionView = {
  session: string
  title?: string
  cwd?: string
  thread?: string
  reference?: string
  url?: string
  visibility?: string
  recording: boolean
  stopped?: boolean
  pending: number
  paused?: string
  diagnostic?: unknown
  ready?: boolean
  activeTurn?: string
  presence?: unknown
  children?: unknown
  upload?: unknown
  remoteTurn?: unknown
  contract?: number
  navigation: { url: string; command: string[] }
}
export const navigation = (session: string, cwd?: string) => ({
  url: `codex://threads/${encodeURIComponent(session)}`,
  command: ['codex', ...(cwd ? ['-C', cwd] : []), 'resume', session],
})

/** A small projection: never return outbox records, tokens or full native history to the panel. */
export function sessionView(value: any): SessionView {
  return {
    session: value.session,
    title: value.title,
    cwd: value.cwd,
    thread: value.thread,
    reference: value.reference,
    url: value.url,
    visibility: value.visibility,
    recording: value.recording ?? !!value.thread,
    stopped: value.stopped,
    pending: value.pending ?? 0,
    paused: value.paused,
    diagnostic: value.diagnostic,
    ready: value.ready,
    activeTurn: value.activeTurn,
    presence: value.presence,
    children: value.children,
    upload: value.upload,
    remoteTurn: value.remoteTurn,
    contract: value.contract,
    navigation: navigation(value.session, value.cwd),
  }
}

export class Operations {
  constructor(
    readonly entrypoint: string,
    readonly directory = dataDirectory(),
    readonly delta = new Delta(),
  ) {}

  async bridge(method: string, params: unknown, timeout?: number) {
    await ensureBridge(this.directory, this.entrypoint)
    return request(this.directory, { method, params }, timeout)
  }

  async native(method: string, params: unknown) {
    const rpc = new Codex()
    try {
      return await rpc.call(method, params, 15_000)
    } finally {
      await rpc.close()
    }
  }

  async status(session: string): Promise<SessionView> {
    try {
      return sessionView(await request(this.directory, { method: 'status', params: { session } }, 3000))
    } catch (error) {
      const saved = (await Recording.load(this.directory, session))?.state
      return sessionView({
        ...saved,
        session,
        recording: false,
        pending: saved?.pending.length ?? 0,
        diagnostic: saved
          ? 'Bridge unavailable; showing saved state. Retry explicitly to reconnect.'
          : String(error),
      })
    }
  }

  async recordings() {
    const files = await readdir(join(this.directory, 'sessions')).catch((e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') return []
      throw e
    })
    const sessions: SessionView[] = []
    for (const file of files.filter((f) => /^[a-f0-9]+\.json$/.test(f)).slice(0, 100)) {
      const saved = await readJson<Binding>(join(this.directory, 'sessions', file))
      if (saved?.session) sessions.push(await this.status(saved.session))
    }
    return { sessions, truncated: files.length > 100 }
  }

  async share(input: {
    session: string
    cwd?: string
    audience?: string
    organization?: string
    emails?: string[]
  }) {
    const { thread } = await this.native('thread/read', { threadId: input.session, includeTurns: false })
    if (!thread?.cwd) throw new Error('The native session has no checkout; sharing was not started.')
    if (input.cwd && (await repository(input.cwd)) !== (await repository(thread.cwd)))
      throw new Error('The selected checkout does not match the native session.')
    return this.bridge('share', { ...input, cwd: thread.cwd })
  }

  async panel(session?: string) {
    const view = session ? await this.status(session) : null
    if (view && (!view.cwd || !view.title)) {
      try {
        const { thread } = await this.native('thread/read', { threadId: session, includeTurns: false })
        view.cwd ??= thread.cwd
        view.title ??= thread.name || thread.preview?.slice(0, 160)
        view.navigation = navigation(view.session, view.cwd)
      } catch {
        /* Saved status remains useful while the native daemon is unavailable. */
      }
    }
    return {
      session: view,
      boundSession: session ?? null,
      observedAt: new Date().toISOString(),
      guidance:
        'Sharing includes conversation, tool inputs/outputs, visible reasoning and nonignored checkout files. Stopping pauses local recording; it does not revoke existing access.',
    }
  }

  async sessions(cursor?: string) {
    const result = await this.native('thread/list', { limit: 20, cursor, archived: false })
    return {
      sessions: result.data.map((t: any) => ({
        session: t.id,
        title: t.name || t.preview?.slice(0, 160) || 'Untitled session',
        cwd: t.cwd,
        navigation: navigation(t.id, t.cwd),
      })),
      nextCursor: result.nextCursor,
    }
  }

  presets(action: 'list' | 'install' | 'remove') {
    return managePresets(action)
  }
}
