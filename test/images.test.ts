import { test, expect } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Images } from '../src/recording/images.ts'

test('local user images are embedded, while non-image files and tool paths are never uploaded as images', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'delta-images-'))
  try {
    const png = join(directory, 'attachment.png'),
      secret = join(directory, 'not-image')
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])
    await writeFile(png, bytes)
    await writeFile(secret, 'sensitive text is not an image')
    const items = [
      {
        type: 'userMessage',
        content: [
          { type: 'localImage', path: png },
          { type: 'localImage', path: secret },
        ],
      },
      { type: 'imageView', path: secret },
    ]
    const result = await new Images().materialize([{ items }])
    expect(result[0].items[0].content[0]).toEqual({
      type: 'image',
      url: `data:image/png;base64,${bytes.toString('base64')}`,
    })
    expect(JSON.stringify(result)).not.toContain('sensitive text')
    expect(result[0].items[1]).toEqual(items[1])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
