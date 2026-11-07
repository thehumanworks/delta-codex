import { open, stat } from 'node:fs/promises'

const MAX_IMAGE = 20 * 1024 * 1024

/** Resolve only user-attached local images from Codex items, never paths mentioned in tool output. */
export class Images {
  private cache = new Map<string, { stamp: string; url: string; bytes: number }>()
  private bytes = 0
  async materialize(turns: any[]): Promise<any[]> {
    const result = structuredClone(turns)
    for (const turn of result)
      for (const item of turn.items ?? []) {
        if (item.type !== 'userMessage' || !Array.isArray(item.content)) continue
        item.content = await Promise.all(
          item.content.map(async (part: any) => {
            if (part.type !== 'localImage' || typeof part.path !== 'string') return part
            try {
              return { type: 'image', url: await this.load(part.path) }
            } catch (error) {
              return {
                type: 'text',
                text: `[Image attachment: ${part.path}; not embedded: ${error instanceof Error ? error.message : String(error)}]`,
              }
            }
          }),
        )
      }
    return result
  }

  private async load(path: string) {
    const info = await stat(path)
    if (!info.isFile() || info.size > MAX_IMAGE) throw new Error('requires an image file of at most 20 MiB')
    const stamp = `${info.size}:${info.mtimeMs}`,
      cached = this.cache.get(path)
    if (cached?.stamp === stamp) return cached.url
    const file = await open(path, 'r')
    let buffer: Buffer
    try {
      const data = Buffer.alloc(Math.min(info.size + 1, MAX_IMAGE + 1))
      let length = 0
      while (length < data.length) {
        const read = await file.read(data, length, data.length - length, length)
        if (!read.bytesRead) break
        length += read.bytesRead
      }
      if (length > MAX_IMAGE) throw new Error('image grew beyond 20 MiB')
      buffer = data.subarray(0, length)
    } finally {
      await file.close()
    }
    const mime = imageMime(buffer)
    if (!mime) throw new Error('unsupported or invalid image signature')
    const url = `data:${mime};base64,${buffer.toString('base64')}`
    if (cached) {
      this.bytes -= cached.bytes
      this.cache.delete(path)
    }
    while (this.bytes + buffer.length > 40 * 1024 * 1024 && this.cache.size) {
      const oldest = this.cache.keys().next().value!
      this.bytes -= this.cache.get(oldest)!.bytes
      this.cache.delete(oldest)
    }
    this.cache.set(path, { stamp, url, bytes: buffer.length })
    this.bytes += buffer.length
    return url
  }
}

function imageMime(data: Buffer) {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg'
  if (['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString())) return 'image/gif'
  if (data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp'
}
