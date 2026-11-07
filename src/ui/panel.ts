import { App, applyDocumentTheme } from '@modelcontextprotocol/ext-apps'
import { OpenAIExtensions } from '@openai/mcp-extensions/app'
import type { SessionView } from '../operations.ts'
import { VERSION } from '../version.ts'

const app = new App({ name: 'Delta workspace', version: VERSION }, {}, { autoResize: true })
const extensions = new OpenAIExtensions(app)
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
let selected: string | undefined, bound: string | undefined, state: SessionView | undefined
let busy = false,
  generation = 0,
  connected = false,
  nextCursor: string | undefined
const node = (tag: string, text: string, className?: string) => {
  const n = document.createElement(tag)
  n.textContent = text
  if (className) n.className = className
  return n
}
const notice = (text: string, error = false) => {
  el('notice').textContent = text
  el('notice').classList.toggle('error', error)
}
const pretty = (id: string, value: unknown) =>
  el(id).replaceChildren(node('pre', JSON.stringify(value, null, 2)))
const button = (text: string, action: () => Promise<unknown>, disabled = false) => {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = text
  b.disabled = disabled || busy
  b.onclick = () => void task(action)
  return b
}
const mutationAllowed = () => !!selected && (!bound || bound === selected)

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await app.callServerTool({ name, arguments: args })
  if (result.isError)
    throw new Error(
      result.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n'),
    )
  const output = result.structuredContent as { data?: any; truncated?: boolean } | undefined
  if (!output || !('data' in output))
    throw new Error('Delta returned no structured result. Refresh before continuing.')
  if (output.truncated) notice('The result is shortened. Narrow the search or read a specific thread.')
  return output.data
}
async function mutate(name: string, args: Record<string, unknown>, scoped = true) {
  if (scoped && !mutationAllowed()) throw new Error('Open the selected session in Codex before changing it.')
  return call(name, { ...args, ...(scoped ? { session: selected } : {}), operationId: crypto.randomUUID() })
}
async function task(action: () => Promise<unknown>) {
  if (busy) return
  busy = true
  document.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.dataset.disabled = String(b.disabled)
    b.disabled = true
  })
  try {
    await action()
  } catch (error) {
    notice(String(error), true)
  } finally {
    busy = false
    document.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.disabled = b.dataset.disabled === 'true'
      delete b.dataset.disabled
    })
    render()
  }
}
async function confirm(title: string, detail: string) {
  const dialog = el<HTMLDialogElement>('confirm-dialog')
  el('confirm-title').textContent = title
  el('confirm-body').textContent = detail
  dialog.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = false))
  return new Promise<boolean>((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true })
    dialog.showModal()
  })
}
function navigation(container: HTMLElement, value: { url: string; command: string[] }) {
  container.append(
    button('Open in Codex', async () => {
      const result = await app.openLink({ url: value.url })
      if (result.isError)
        throw new Error('This host cannot open the session. Use the resume arguments shown below.')
    }),
  )
  container.append(node('pre', value.command.map((a) => JSON.stringify(a)).join(' ')))
}
function render() {
  const box = el('session')
  box.replaceChildren()
  if (!state) {
    box.append(node('p', 'Choose a native Codex session to inspect sharing.'))
  } else {
    box.append(
      node('p', state.title || 'Codex session', 'session-title'),
      node('code', state.session),
      node('p', state.cwd || 'Checkout appears after sharing', 'muted'),
    )
    const status = state.paused
      ? 'Paused'
      : state.stopped
        ? 'Recording stopped'
        : state.recording
          ? state.ready === false
            ? 'Connecting'
            : 'Recording'
          : state.thread
            ? 'Disconnected'
            : 'Not shared'
    box.append(
      node('span', status, 'badge'),
      node('span', state.visibility || (state.thread ? 'Audience pending' : 'Audience not set'), 'badge'),
      node('span', `${state.pending} pending`, 'badge'),
    )
    if (state.upload) {
      const upload = state.upload as { state?: string; error?: { message?: string } }
      box.append(
        node(
          'p',
          `Cloud upload: ${upload.state ?? 'unknown'}${upload.error?.message ? ` — ${upload.error.message}` : ''}`,
        ),
      )
    }
    if (state.diagnostic)
      box.append(
        node('p', typeof state.diagnostic === 'string' ? state.diagnostic : JSON.stringify(state.diagnostic)),
      )
    if (state.url && /^https:\/\//.test(state.url)) {
      const url = state.url
      const link = document.createElement('input')
      link.value = url
      link.readOnly = true
      link.setAttribute('aria-label', 'Delta share link')
      box.append(link)
      box.append(
        button('Copy link', async () => {
          try {
            await navigator.clipboard.writeText(url)
            notice('Link copied.')
          } catch {
            link.select()
            notice('Select and copy the link above.')
          }
        }),
      )
      box.append(
        button('Open Delta', async () => {
          await app.openLink({ url })
        }),
      )
    }
    const actions = document.createElement('div')
    actions.className = 'actions'
    navigation(actions, state.navigation)
    if (state.thread) {
      actions.append(
        button(
          'Retry sync',
          async () => {
            await mutate('delta_retry', {})
            await refresh()
          },
          !mutationAllowed(),
        ),
      )
      actions.append(
        button(
          'Stop recording',
          async () => {
            if (
              await confirm(
                'Stop recording?',
                'Existing shared content and access remain. Only local recording stops.',
              )
            ) {
              await mutate('delta_stop', {})
              await refresh()
            }
          },
          !mutationAllowed() || state.stopped,
        ),
      )
      if (state.paused)
        for (const action of ['fork', 'discard'] as const)
          actions.append(
            button(
              action === 'fork' ? 'Preserve changes in a fork' : 'Discard rejected changes',
              async () => {
                if (
                  await confirm(
                    'Resolve rejected changes?',
                    action === 'fork'
                      ? 'Preserve rejected changes in a fork, then discard them from this checkout.'
                      : 'Discard rejected checkout changes. This can lose local work.',
                  )
                ) {
                  await mutate('delta_recover', { action, confirm: true })
                  await refresh()
                }
              },
              !mutationAllowed(),
            ),
          )
    }
    box.append(actions)
    if (state.presence) {
      const d = document.createElement('details')
      d.append(node('summary', 'People and activity'), node('pre', JSON.stringify(state.presence, null, 2)))
      box.append(d)
    }
    if (state.children) {
      const d = document.createElement('details')
      d.append(node('summary', 'Child threads'), node('pre', JSON.stringify(state.children, null, 2)))
      box.append(d)
    }
    if (bound && bound !== selected)
      box.append(node('p', 'Viewing another session. Open it in Codex to change sharing or start work.'))
  }
  for (const id of ['share-form', 'branch-form', 'run-form'])
    el(id)
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, textarea, button')
      .forEach((e) => (e.disabled = busy || !mutationAllowed()))
}
async function refresh() {
  const version = ++generation,
    target = selected
  const result = await call('delta_panel', target ? { session: target } : {})
  if (version !== generation || selected !== target) return
  bound = result.boundSession ?? undefined
  state = result.session ?? undefined
  selected = state?.session ?? selected
  render()
  notice(`Updated ${new Date(result.observedAt).toLocaleTimeString()}.`)
}
async function browse(more = false) {
  const result = await call('delta_sessions', more && nextCursor ? { cursor: nextCursor } : {})
  nextCursor = result.nextCursor
  const box = el('sessions')
  if (!more) box.replaceChildren()
  box.querySelector('[data-more]')?.remove()
  for (const entry of result.sessions)
    box.append(
      button(entry.title, async () => {
        selected = entry.session
        state = undefined
        generation++
        render()
        await refresh()
      }),
    )
  if (nextCursor) {
    const b = button('More sessions', () => browse(true))
    b.dataset.more = 'true'
    box.append(b)
  }
}
function form(id: string, action: (data: FormData, event: SubmitEvent) => Promise<unknown>) {
  el<HTMLFormElement>(id).addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget as HTMLFormElement)
    void task(() => action(data, event))
  })
}
form('share-form', async (data) => {
  await mutate('delta_share', {
    audience: data.get('audience'),
    organization: data.get('organization'),
    ...(data.get('audience') === 'invite'
      ? {
          emails: String(data.get('emails'))
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }
      : {}),
  })
  el<HTMLFormElement>('share-form').reset()
  await refresh()
})
el('share-form').addEventListener('change', () => {
  el('emails-label').hidden = new FormData(el<HTMLFormElement>('share-form')).get('audience') !== 'invite'
})
form('join-form', async (data) => {
  const result = await mutate('delta_join', { reference: data.get('reference') }, false)
  const box = el('joined')
  box.replaceChildren(node('p', 'Thread joined. Continue in its native Codex session.'))
  navigation(box, result.navigation)
})
form('search-form', async (data) =>
  pretty('thread-result', await call('delta_search', { query: data.get('query') })),
)
form('thread-form', async (data, event) =>
  pretty(
    'thread-result',
    await call('delta_thread', {
      reference: data.get('reference'),
      view: (event.submitter as HTMLButtonElement)?.value || 'show',
    }),
  ),
)
form('branch-form', async (data) =>
  pretty(
    'thread-result',
    await mutate('delta_branch', { name: data.get('name'), isolated: data.has('isolated') }),
  ),
)
form('run-form', async (data) => {
  if (
    !(await confirm(
      'Start a child run?',
      'This starts a model turn using your Codex account. The child inherits the parent’s permission limits.',
    ))
  )
    return
  const result = await mutate('delta_run', {
    reference: data.get('reference'),
    prompt: data.get('prompt'),
    write: data.has('write'),
  })
  const box = el('run-result')
  box.replaceChildren(node('p', `Run started: ${result.session}`))
  navigation(box, { url: `codex://threads/${encodeURIComponent(result.session)}`, command: result.resume })
  box.append(
    button('Review pending requests', async () =>
      pretty('thread-result', await call('delta_pending', { session: result.session })),
    ),
  )
  box.append(
    button('Interrupt this turn', async () =>
      pretty(
        'thread-result',
        await mutate('delta_control', { child: result.session, turn: result.turn, action: 'interrupt' }),
      ),
    ),
  )
  const steer = document.createElement('form'),
    input = document.createElement('input'),
    label = document.createElement('label'),
    submit = document.createElement('button')
  input.required = true
  input.maxLength = 16000
  label.textContent = 'Steer this turn'
  label.append(input)
  submit.textContent = 'Send'
  steer.append(label, submit)
  steer.onsubmit = (event) => {
    event.preventDefault()
    void task(async () => {
      await mutate('delta_control', {
        child: result.session,
        turn: result.turn,
        action: 'send',
        prompt: input.value,
      })
      input.value = ''
    })
  }
  box.append(steer)
})
el('refresh').onclick = () => void task(refresh)
el('browse').onclick = () => void task(() => browse())
el('account').onclick = () =>
  void task(async () => {
    const result = await call('delta_account'),
      box = el('account-result')
    box.replaceChildren(
      node(
        'p',
        result.auth.status === 'signed_in'
          ? `Signed in${result.auth.account?.login ? ` as ${result.auth.account.login}` : ''}. Choose an organization:`
          : 'Sign in with the Delta CLI to continue.',
      ),
    )
    for (const org of result.organizations.organizations ?? [])
      box.append(
        button(org.name, async () => {
          el<HTMLInputElement>('organization').value = org.id
          notice(`Organization selected: ${org.name}`)
        }),
      )
  })
for (const action of ['install', 'remove'])
  el(`presets-${action}`).onclick = () =>
    void task(async () => pretty('presets-result', await call('delta_presets', { action })))
el('expand').onclick = () => void task(() => app.requestDisplayMode({ mode: 'fullscreen' }))
app.onhostcontextchanged = (context) => {
  if (context.theme) applyDocumentTheme(context.theme)
  el('expand').hidden = !context.availableDisplayModes?.includes('fullscreen')
}
app.ontoolresult = (result) => {
  if (busy) return // A notification must not retarget an in-flight confirmation or action.
  const data = result.structuredContent?.data as any
  if (data && 'boundSession' in data) {
    generation++
    bound = data.boundSession ?? undefined
    state = data.session ?? undefined
    selected = state?.session
    render()
    notice('Session loaded.')
  }
}
app.onteardown = async () => {
  connected = false
  clearInterval(timer)
  return {}
}
const timer = setInterval(() => {
  if (connected && !busy && !document.hidden) void task(refresh)
}, 15000)
void app
  .connect()
  .then(async () => {
    connected = true
    const context = app.getHostContext()
    if (context?.theme) applyDocumentTheme(context.theme)
    el('expand').hidden = !context?.availableDisplayModes?.includes('fullscreen')
    // Optional host extension is additive; the standard bridge remains sufficient.
    const deepLink = extensions.deepLink.getCurrent()
    if (deepLink) notice('Delta workspace opened. Select a native session to continue.')
    await task(refresh)
  })
  .catch((error) =>
    notice(`Unable to connect: ${String(error)}. Use the Delta skills or CLI in this host.`, true),
  )
