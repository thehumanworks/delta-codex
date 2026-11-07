import { Codex } from './rpc.ts'

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

/** Use Codex's versioned editor, preserving comments and unrelated configuration. */
export async function managePresets(action: 'list' | 'install' | 'remove', rpc = new Codex()) {
  try {
    const response = await rpc.call('config/read', { includeLayers: true })
    const layer = (response.layers as Layer[] | undefined)?.find(
      (l) => l.name.type === 'user' && !l.name.profile && !l.disabledReason,
    )
    if (!layer?.name.file || !layer.version)
      throw new Error('Codex did not expose a writable user configuration layer.')
    const effective = response.config.tui?.presets ?? {}
    const owned = layer.config.tui?.presets ?? {}
    const edits: { keyPath: string; value: Preset | null; mergeStrategy: 'replace' }[] = []
    const assigned: { slot: string; label: string }[] = []
    if (action === 'install') {
      const used = new Set(Object.keys(effective))
      for (const preset of PRESETS) {
        const existing = Object.entries(effective).find(([, value]) => matches(value, preset))
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
    return {
      action,
      changed: edits.length,
      assigned,
      presets: action === 'list' ? effective : undefined,
      guidance:
        'Use /presets to view shortcuts. Restart the CLI if its menu has not refreshed. Edited shortcuts are yours and will not be removed.',
    }
  } finally {
    await rpc.close()
  }
}
