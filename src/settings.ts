import { join, isAbsolute } from 'node:path'
import { readFile, appendFile, mkdir } from 'node:fs/promises'
import { run } from './core/process.ts'
import { atomicJson, readJson } from './core/storage.ts'

export type Policy = { mode: 'manual' | 'private' | 'organization'; organization?: string }
export class NotRepositoryError extends Error {}

export async function repository(cwd: string) {
  const result = await run(['git', '-C', cwd, 'rev-parse', '--show-toplevel'])
  if (result.code !== 0)
    throw new NotRepositoryError(
      'Delta needs a Git checkout. Start Codex inside the repository to share its files.',
    )
  return result.stdout.trim()
}

export async function readPolicy(cwd: string): Promise<Policy> {
  const root = await repository(cwd)
  const value = await readJson<any>(join(root, '.delta', 'settings.json'))
  if (!value) return { mode: 'manual' }
  const threads = value.threads
  if (
    !threads ||
    !['manual', 'private', 'organization'].includes(threads.mode) ||
    (threads.mode !== 'manual' && (typeof threads.organization !== 'string' || !threads.organization.trim()))
  )
    throw new Error(
      'Invalid .delta/settings.json: threads.mode must be manual, private or organization; automatic modes need threads.organization. Automatic syncing is disabled.',
    )
  return { mode: threads.mode, organization: threads.organization }
}

export async function writePolicy(cwd: string, policy: Policy) {
  if (
    !['manual', 'private', 'organization'].includes(policy.mode) ||
    (policy.mode !== 'manual' && !policy.organization?.trim())
  )
    throw new Error('Choose a mode and an organization ID for automatic sync')
  const root = await repository(cwd)
  const tracked = await run(['git', '-C', root, 'ls-files', '--', '.delta/settings.json'])
  if (tracked.stdout.trim())
    throw new Error(
      '.delta/settings.json is tracked by Git. Untrack it before saving a personal automatic-sharing policy.',
    )
  const excludeResult = await run(['git', '-C', root, 'rev-parse', '--git-path', 'info/exclude'])
  if (excludeResult.code !== 0) throw new Error('Cannot locate Git’s local exclude file')
  const exclude = isAbsolute(excludeResult.stdout.trim())
    ? excludeResult.stdout.trim()
    : join(root, excludeResult.stdout.trim())
  const current = await readFile(exclude, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return ''
    throw error
  })
  if (!current.split('\n').includes('/.delta/')) {
    await mkdir(join(exclude, '..'), { recursive: true })
    await appendFile(exclude, `${current.endsWith('\n') || !current ? '' : '\n'}/.delta/\n`)
  }
  const path = join(root, '.delta', 'settings.json'),
    previous = await readJson<Record<string, unknown>>(path)
  await atomicJson(path, { ...previous, threads: policy })
  return { root, policy }
}
