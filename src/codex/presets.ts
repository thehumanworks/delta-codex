import { Codex } from './rpc.ts'
import { mkdir, open, stat, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { atomicJson, readJson } from '../core/storage.ts'
import { deadline } from '../core/process.ts'

export const PRESETS = [
  {
    label: 'Delta status',
    input: 'Use $delta-codex:status to show Delta sharing and sync status for this session.',
  },
  {
    label: 'Delta share',
    input: 'Use $delta-codex:share to share this session privately. Ask for the organization if needed.',
  },
  { label: 'Delta join', input: 'Use $delta-codex:join to join a Delta thread. Ask me for its link.' },
]

type Preset = { label: string; input: string }
type Layer = {
  name: { type: string; file?: string; profile?: string }
  version: string
  config: any
  disabledReason?: string
}
const matches = (a: any, b: Preset) =>
  a?.label === b.label && a?.input === b.input && Object.keys(a).length === 2

type SetupState = { version: 1; status: 'complete' | 'disabled' }

// Serialize first-session setup and explicit install/remove across plugin processes.
// Native expectedVersion still protects edits made by Codex or another config editor.
async function presetLock(path: string) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const lockPath = `${path}.lock`
  const busy = () => new Error('Delta preset setup is already running. Retry shortly.')
  let lock
  try {
    lock = await open(lockPath, 'wx', 0o600)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    let recovery
    try {
      recovery = await open(`${lockPath}.recovery`, 'wx', 0o600)
    } catch {
      throw busy()
    }
    try {
      const owner = await readJson<{ pid: number }>(lockPath).catch(() => undefined)
      if (owner && Number.isSafeInteger(owner.pid) && owner.pid > 0) {
        let exited = false
        try {
          process.kill(owner.pid, 0)
        } catch (error) {
          exited = (error as NodeJS.ErrnoException).code === 'ESRCH'
        }
        if (!exited) throw busy()
      } else {
        const info = await stat(lockPath).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error
          return undefined
        })
        if (!info || Date.now() - info.mtimeMs < 10_000) throw busy()
      }
      await unlink(lockPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
      })
      lock = await open(lockPath, 'wx', 0o600)
    } finally {
      await recovery.close()
      await unlink(`${lockPath}.recovery`)
    }
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid }))
    await lock.sync()
  } catch (error) {
    await lock.close()
    await unlink(lockPath)
    throw error
  }
  return async () => {
    await lock.close()
    await unlink(lockPath)
  }
}

/** Use Codex's versioned editor, preserving comments and unrelated configuration. */
export async function managePresets(action: 'list' | 'install' | 'remove' | 'ensure', rpc = new Codex()) {
  let unlock: (() => Promise<void>) | undefined
  try {
    const readConfig = async () => {
      const response = await rpc.call('config/read', { includeLayers: true })
      const layer = (response.layers as Layer[] | undefined)?.find(
        (l) => l.name.type === 'user' && !l.name.profile && !l.disabledReason,
      )
      if (!layer?.name.file || !layer.version)
        throw new Error('Codex did not expose a writable user configuration layer.')
      return { response, layer }
    }
    let { response, layer } = await readConfig()
    // Presets belong to the writable Codex profile, even when Delta recording
    // storage is redirected or shared via DELTA_CODEX_HOME.
    const configFile = layer.name.file!
    const statePath = join(dirname(configFile), 'delta', 'presets.json')
    if (action !== 'list') {
      unlock = await presetLock(statePath)
      // Another plugin process may have finished between our first read and
      // acquiring the lock. Never remove/install from that stale snapshot.
      ;({ response, layer } = await readConfig())
      if (layer.name.file !== configFile) throw new Error('Codex configuration layer changed; retry setup.')
    }
    const setup = await readJson<SetupState>(statePath)
    if (setup && (setup.version !== 1 || !['complete', 'disabled'].includes(setup.status)))
      throw new Error('Unrecognized Delta preset setup state; left unchanged.')
    const effective = response.config.tui?.presets ?? {}
    const owned = layer.config.tui?.presets ?? {}
    const edits: { keyPath: string; value: Preset | null; mergeStrategy: 'replace' }[] = []
    const assigned: { slot: string; label: string }[] = []
    if (action === 'install' || (action === 'ensure' && !setup)) {
      const used = new Set(Object.keys(effective))
      for (const preset of PRESETS) {
        const existing = Object.entries(effective).find(
          ([, value]: [string, any]) =>
            matches(value, preset) ||
            (action === 'ensure' && value?.label === preset.label && typeof value.input === 'string'),
        )
        const slot =
          existing?.[0] ??
          Array.from({ length: 10 }, (_, i) => String((i + 1) % 10)).find((s) => !used.has(s))
        if (!slot)
          throw new Error('Not enough empty preset slots. No changes were made. Manage slots with /presets.')
        used.add(slot)
        assigned.push({ slot, label: preset.label })
        if (!existing) edits.push({ keyPath: `tui.presets.${slot}`, value: preset, mergeStrategy: 'replace' })
      }
    } else if (action === 'remove') {
      for (const [slot, value] of Object.entries(owned)) {
        if (/^[0-9]$/.test(slot) && PRESETS.some((p) => matches(value, p)))
          edits.push({ keyPath: `tui.presets.${slot}`, value: null, mergeStrategy: 'replace' })
      }
    }
    if (edits.length)
      await rpc.call('config/batchWrite', {
        filePath: layer.name.file,
        expectedVersion: layer.version,
        edits,
      })
    if (action !== 'list' && (action !== 'ensure' || !setup))
      await atomicJson(statePath, {
        version: 1,
        status: action === 'remove' ? 'disabled' : 'complete',
      } satisfies SetupState)
    return {
      action,
      changed: edits.length,
      assigned,
      presets: action === 'list' ? effective : undefined,
      automaticSetup:
        action === 'remove'
          ? 'disabled'
          : action === 'list'
            ? (setup?.status ?? 'pending')
            : setup?.status === 'disabled' && action === 'ensure'
              ? 'disabled'
              : 'complete',
      guidance:
        'Use /presets to view shortcuts. Restart the CLI if its menu has not refreshed. Edited shortcuts are yours and will not be removed.',
    }
  } finally {
    try {
      await unlock?.()
    } finally {
      await rpc.close()
    }
  }
}

/** A shortcut failure must never block a native session or its recording hook. */
export async function initializePresets(rpc = new Codex()) {
  try {
    const result = await deadline(managePresets('ensure', rpc), 5000, 'Delta preset setup')
    return result.changed
      ? {
          context: `Delta presets installed: ${result.assigned.map((p) => `${p.slot}: ${p.label}`).join(', ')}. Open /presets; restart the CLI if its menu has not refreshed.`,
        }
      : {}
  } catch (error) {
    return {
      warning: `Delta presets could not be installed: ${error instanceof Error ? error.message : String(error)} Use presets install to retry, or presets remove to disable automatic setup.`,
    }
  } finally {
    await rpc.close().catch(() => {})
  }
}
