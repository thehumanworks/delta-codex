import { test, expect, vi } from 'vitest'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from '../src/mcp/server.ts'
import { Operations, sessionView } from '../src/operations.ts'

test.skipIf(process.env.DELTA_CODEX_UI_TEST !== '1')(
  'built panel works through the MCP Apps host bridge in light, dark and narrow views',
  async () => {
    const html = await readFile('dist/panel.html', 'utf8')
    const host = await build({
      entryPoints: ['test/ui-host.ts'],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      write: false,
    })
    const state = {
      session: 'native-caller',
      title: 'Synthetic collaboration fixture',
      cwd: '/fixture',
      recording: false,
      pending: 0,
      visibility: undefined as string | undefined,
      thread: undefined as string | undefined,
      url: undefined as string | undefined,
      stopped: false,
    }
    const operations = new Operations('unused')
    vi.spyOn(operations, 'panel').mockImplementation(async (session) => ({
      session: sessionView(
        session === 'other-session' ? { session, title: 'Another session', recording: false } : state,
      ),
      boundSession: 'native-caller',
      observedAt: new Date().toISOString(),
      guidance: 'Fixture',
    }))
    vi.spyOn(operations, 'sessions').mockResolvedValue({
      sessions: [
        { session: 'other-session', title: 'Another session' },
        { session: 'native-caller', title: state.title },
      ],
      nextCursor: null,
    })
    const share = vi.spyOn(operations, 'share').mockImplementation(async (args) => {
      Object.assign(state, {
        recording: true,
        visibility: args.audience,
        thread: 'opaque-thread',
        url: 'https://delta.example/thread',
      })
      return state
    })
    const bridgeCall = vi.spyOn(operations, 'bridge').mockImplementation(async (method) => {
      if (method === 'join')
        return {
          session: 'joined-session',
          directory: '/joined',
          resume: ['codex', '-C', '/joined', 'resume', 'joined-session'],
        }
      if (method === 'stop') {
        state.stopped = true
        state.recording = false
        return state
      }
      if (method === 'retry') throw new Error('Synthetic network failure. Inspect status before retrying.')
      return {}
    })
    const mcp = createMcpServer(operations, async () => html),
      client = new Client({ name: 'fixture', version: '1' })
    const [a, b] = InMemoryTransport.createLinkedPair()
    await mcp.connect(a)
    await client.connect(b)
    const server = createServer(async (req, res) => {
      if (req.url?.startsWith('/tool')) {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk)
        const args = JSON.parse(Buffer.concat(chunks).toString())
        const result = await client.callTool({ ...args, _meta: { threadId: 'native-caller' } })
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(result))
      } else if (req.url === '/panel') {
        res.setHeader('content-type', 'text/html')
        res.end(html)
      } else if (req.url === '/host.js') {
        res.setHeader('content-type', 'text/javascript')
        res.end(host.outputFiles[0]!.text)
      } else {
        res.setHeader('content-type', 'text/html')
        res.end(
          '<!doctype html><iframe title="Delta" style="border:0;width:100%;height:1600px" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe><script type="module" src="/host.js"></script>',
        )
      }
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const browser = await chromium.launch({
      executablePath: process.env.DELTA_CODEX_CHROMIUM,
      headless: true,
      args: ['--no-sandbox'],
    })
    try {
      const page = await browser.newPage({ viewport: { width: 820, height: 1100 } }),
        errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const base = `http://127.0.0.1:${(server.address() as any).port}`
      await page.goto(base)
      const frame = page.frameLocator('iframe')
      await frame.getByText('Not shared', { exact: true }).waitFor()
      expect(await frame.getByRole('button', { name: 'Expand', exact: true }).isVisible()).toBe(true)
      await frame.getByLabel('Organization ID').fill('synthetic-org')
      await frame.getByRole('button', { name: 'Share selected session' }).click()
      expect(share).not.toHaveBeenCalled() // Native form validation requires review.
      await frame.getByLabel('I have reviewed').check()
      await frame.getByRole('button', { name: 'Share selected session' }).dblclick()
      await frame.getByText('Recording', { exact: true }).waitFor()
      expect(share).toHaveBeenCalledTimes(1)
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ session: 'native-caller', audience: 'private' }),
      )
      await frame.getByLabel('Delta link or reference').fill('opaque:child/reference')
      await frame.getByRole('button', { name: 'Join thread', exact: true }).click()
      await frame.getByText('Thread joined. Continue in its native Codex session.').waitFor()
      await frame.locator('#joined').getByRole('button', { name: 'Open in Codex' }).click()
      await expect
        .poll(() => page.evaluate(() => (window as any).openedLink))
        .toBe('codex://threads/joined-session')
      await frame.getByRole('button', { name: 'Retry sync' }).click()
      await frame.getByRole('status').filter({ hasText: 'Synthetic network failure' }).waitFor()
      expect(bridgeCall.mock.calls.filter(([method]) => method === 'retry')).toHaveLength(1)
      await frame.getByRole('button', { name: 'Stop recording', exact: true }).click()
      await frame.getByRole('button', { name: 'Cancel', exact: true }).click()
      expect(bridgeCall.mock.calls.filter(([method]) => method === 'stop')).toHaveLength(0)
      await frame.getByRole('button', { name: 'Choose session', exact: true }).click()
      await frame.getByRole('button', { name: 'Another session', exact: true }).click()
      await frame.getByText('Viewing another session.', { exact: false }).waitFor()
      expect(await frame.getByRole('button', { name: 'Share selected session' }).isDisabled()).toBe(true)
      expect(share).toHaveBeenCalledTimes(1)
      await frame.getByRole('button', { name: state.title, exact: true }).click()
      const artifact = process.env.DELTA_CODEX_UI_ARTIFACTS
      if (artifact) {
        await mkdir(artifact, { recursive: true })
        await page.screenshot({ path: join(artifact, 'panel-light.png') })
      }
      await page.setViewportSize({ width: 390, height: 1000 })
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto(`${base}/?theme=dark&basic=1`)
      await frame.getByText('Recording', { exact: true }).waitFor()
      expect(await frame.getByRole('button', { name: 'Expand', exact: true }).isVisible()).toBe(false)
      const widths = await frame
        .locator('body')
        .evaluate((body) => ({ body: body.scrollWidth, viewport: window.innerWidth }))
      expect(widths.body).toBeLessThanOrEqual(widths.viewport)
      if (artifact) await page.screenshot({ path: join(artifact, 'panel-dark-narrow.png') })
      expect(errors).toEqual([])
    } finally {
      await browser.close()
      await client.close()
      await mcp.close()
      server.closeAllConnections()
      await new Promise<void>((r) => server.close(() => r()))
    }
  },
  60_000,
)
