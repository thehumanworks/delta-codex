import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const dataDirectory = () =>
  process.env.DELTA_CODEX_HOME || join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'delta')

/** A failed write leaves the old file intact. Acknowledgments and records share one transaction. */
export async function atomicJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temp = `${path}.${randomUUID()}.tmp`
  const file = await open(temp, 'wx', 0o600)
  try {
    await file.writeFile(JSON.stringify(value) + '\n')
    await file.sync()
  } finally {
    await file.close()
  }
  try {
    await rename(temp, path)
    if (process.platform !== 'win32') {
      const directory = await open(dirname(path), 'r')
      try {
        await directory.sync()
      } finally {
        await directory.close()
      }
    }
  } finally {
    await unlink(temp).catch(() => {})
  }
}

export async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

/** All mutations of one file are serialized; a rejected transaction never poisons the queue. */
export class Serial {
  private tail: Promise<unknown> = Promise.resolve()
  run<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work)
    this.tail = next.catch(() => {})
    return next
  }
}
