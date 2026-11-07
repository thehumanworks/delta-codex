import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { Delta } from './cli/delta.ts'
import { Codex } from './codex/rpc.ts'
import { run, MAX_FRAME } from './core/process.ts'
import { dataDirectory } from './core/storage.ts'
import { ensureBridge, request, serve } from './ipc.ts'
import { writePolicy } from './settings.ts'
import { Recording } from './recording/store.ts'
import { readFile } from 'node:fs/promises'

let hookEvent: any

const HELP = `Delta for Codex 0.1.0

  delta-codex doctor
  delta-codex bridge-stop
  delta-codex setup --mode manual|private|organization [--org ID] [--cwd PATH]
  delta-codex share --session CODEX_ID --audience private|organization|invite --org ID [--email ADDRESS ...]
  delta-codex join THREAD_OR_LINK
  delta-codex status [--session CODEX_ID]
  delta-codex retry --session CODEX_ID
  delta-codex stop --session CODEX_ID
  delta-codex resolve --session CODEX_ID --action fork|discard --confirm
  delta-codex auth status|login
  delta-codex org list|current|switch ID|create NAME|invite EMAIL ... [--org ID]
  delta-codex search QUERY | show THREAD | tree THREAD
  delta-codex fork THREAD | merge CHILD --into PARENT --confirm
  delta-codex update [--check]
  delta-codex branch --session PARENT --name NAME [--isolated]
  delta-codex run THREAD --session PARENT --prompt TEXT [--write]
  delta-codex send --session CHILD --turn TURN_ID --prompt TEXT
  delta-codex wait --session CHILD [--seconds 30]
  delta-codex interrupt --session CHILD --turn TURN_ID
  delta-codex pending [--session CHILD]
  delta-codex answer --request ID --decision accept|decline

All results are JSON. Hooks are trusted through Codex /hooks. Sharing includes
conversation, tool inputs/outputs, visible reasoning, and nonignored checkout files.
Never use the most recent session as a substitute for the current session ID.
Environment: DELTA_CODEX_HOME, DELTA_CODEX_DELTA_BIN, DELTA_CODEX_CODEX_BIN.
`

async function main() {
  const { values: flags, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean' },
      session: { type: 'string' },
      cwd: { type: 'string' },
      audience: { type: 'string' },
      org: { type: 'string' },
      email: { type: 'string', multiple: true },
      mode: { type: 'string' },
      action: { type: 'string' },
      confirm: { type: 'boolean' },
      check: { type: 'boolean' },
      into: { type: 'string' },
      name: { type: 'string' },
      isolated: { type: 'boolean' },
      prompt: { type: 'string' },
      write: { type: 'boolean' },
      turn: { type: 'string' },
      seconds: { type: 'string' },
      request: { type: 'string' },
      decision: { type: 'string' },
      'answers-file': { type: 'string' },
    },
  })
  const [command, ...args] = positionals
  if (flags.version) {
    console.log('0.1.0')
    return
  }
  if (!command || flags.help) {
    console.log(HELP)
    return
  }
  const directory = dataDirectory(),
    delta = new Delta(),
    cwd = resolve(flags.cwd ?? process.cwd())
  const session = () => {
    const value = flags.session || process.env.CODEX_THREAD_ID
    if (!value)
      throw new Error(
        'Pass --session with the current Codex session ID from the SessionStart hook or CODEX_THREAD_ID. No session is guessed.',
      )
    return value
  }
  const first = () => {
    if (!args[0] || args[0].startsWith('-')) throw new Error(`${command} needs an explicit argument`)
    return args[0]
  }
  const call = async (method: string, params: unknown, timeout?: number) => {
    await ensureBridge(directory, fileURLToPath(import.meta.url))
    return request(directory, { method, params }, timeout)
  }
  let result: unknown
  switch (command) {
    case 'serve':
      await serve(directory)
      return
    case 'bridge-stop':
      result = await request(directory, { method: 'shutdown', params: {} }, 3000)
      break
    case 'hook': {
      let input = ''
      for await (const chunk of process.stdin) {
        input += chunk.toString()
        if (input.length > MAX_FRAME) throw new Error('Hook payload too large')
      }
      const event = (hookEvent = JSON.parse(input))
      // End/interrupt have a three-second host budget. They only enqueue cleanup.
      result = ['Interrupt', 'SessionEnd'].includes(event.hook_event_name)
        ? await request(directory, { method: 'hook', params: event }, 1800)
        : await call('hook', event, 25_000)
      break
    }
    case 'doctor': {
      const checks = await Promise.allSettled([
        run([delta.executable, '--version']),
        run([process.env.DELTA_CODEX_CODEX_BIN || 'codex', '--version']),
        delta.contract(),
      ])
      const rpc = new Codex()
      let daemon: unknown
      try {
        daemon = await rpc.call('thread/loaded/list', {}, 5000)
      } catch (error) {
        daemon = { error: String(error) }
      } finally {
        await rpc.close()
      }
      result = {
        node: process.version,
        dataDirectory: directory,
        checks: checks.map((c, i) => ({
          name: ['delta', 'codex', 'contract'][i],
          ...(c.status === 'fulfilled' ? { value: c.value } : { error: String(c.reason) }),
        })),
        daemon,
        guidance:
          'Requires Codex 0.166.0+ with shared daemon and trusted hooks, Delta contract 8–10, and Node 22.19+. No login or upload is performed by doctor.',
      }
      break
    }
    case 'setup': {
      if (!flags.mode || !['manual', 'private', 'organization'].includes(flags.mode))
        throw new Error('Choose --mode manual, private or organization')
      result = await writePolicy(cwd, {
        mode: flags.mode as 'manual' | 'private' | 'organization',
        organization: flags.org,
      })
      break
    }
    case 'share':
      result = await call('share', {
        session: session(),
        cwd,
        audience: flags.audience,
        organization: flags.org,
        emails: flags.email,
      })
      break
    case 'join':
      result = await call('join', { reference: first() })
      break
    case 'status':
      result = await call('status', { session: flags.session })
      break
    case 'retry':
    case 'stop':
      result = await call(command, { session: session() })
      break
    case 'branch':
      if (!flags.name) throw new Error('Choose --name for the new Delta child')
      result = await call('branch', { session: session(), name: flags.name, isolated: !!flags.isolated })
      break
    case 'run':
      if (!flags.prompt) throw new Error('Provide --prompt for the background run')
      result = await call('run', {
        session: session(),
        reference: first(),
        prompt: flags.prompt,
        write: !!flags.write,
      })
      break
    case 'send':
    case 'interrupt':
      if (!flags.turn || (command === 'send' && !flags.prompt))
        throw new Error('Provide --turn and a --prompt for send')
      result = await call(command, { session: session(), turn: flags.turn, prompt: flags.prompt })
      break
    case 'wait':
      if (
        flags.seconds &&
        (!Number.isFinite(Number(flags.seconds)) || Number(flags.seconds) < 0 || Number(flags.seconds) > 50)
      )
        throw new Error('--seconds must be between 0 and 50')
      result = await call('wait', { session: session(), seconds: Number(flags.seconds ?? 30) })
      break
    case 'pending':
      result = await call('pending', { session: flags.session })
      break
    case 'answer':
      if (!flags.request) throw new Error('Provide --request for the pending request ID')
      result = await call('answer', {
        id: flags.request,
        decision: flags.decision,
        answers: flags['answers-file']
          ? JSON.parse(await readFile(flags['answers-file'], 'utf8'))
          : undefined,
      })
      break
    case 'resolve':
      if (!flags.confirm || !['fork', 'discard'].includes(flags.action ?? ''))
        throw new Error(
          'Recovery needs --action fork|discard --confirm. Fork preserves rejected changes before discarding; discard drops them.',
        )
      result = await call('resolve', { session: session(), action: flags.action })
      break
    case 'auth':
      if (!['status', 'login'].includes(first())) throw new Error('Use auth status or auth login')
      result = await delta.command(['auth', ...args, ...(args[0] === 'login' ? ['--no-wait'] : [])])
      break
    case 'org': {
      if (!['list', 'current', 'create', 'switch', 'invite'].includes(first()))
        throw new Error('Unknown organization operation')
      const [operation, ...rest] = args
      result = await delta.command([
        'org',
        operation!,
        ...(flags.org ? ['--org', flags.org] : []),
        ...(rest.length ? ['--', ...rest] : []),
      ])
      break
    }
    case 'search':
      result = await delta.query(['thread', 'search', '--', args.join(' ')])
      break
    case 'show':
    case 'tree':
      result = await delta.query(['thread', command, first()])
      break
    case 'fork':
      result = await delta.command(['thread', command, first()])
      break
    case 'merge':
      if (!flags.confirm || !flags.into) throw new Error('Merge changes needs --into PARENT --confirm')
      result = await delta.command(['thread', 'merge', first(), '--into', flags.into])
      break
    case 'update':
      result = await delta.command(['update', ...(flags.check ? ['--check'] : [])])
      break
    default:
      throw new Error(`Unknown command ${command}. Run delta-codex --help.`)
  }
  console.log(JSON.stringify(result, null, command === 'hook' ? undefined : 2))
}

main().catch(async (error) => {
  if (process.argv[2] === 'hook') {
    const message = `Delta: ${error instanceof Error ? error.message : String(error)}. Run Delta doctor or retry.`
    let output: Record<string, unknown> = { systemMessage: message }
    // A missing bridge must not let a shared agent write after somebody else takes over.
    // Unshared sessions continue normally. A damaged binding is treated as potentially shared.
    if (hookEvent?.session_id) {
      const saved = await Recording.load(dataDirectory(), hookEvent.agent_id || hookEvent.session_id).catch(
        () => ({ state: { stopped: false } }),
      )
      if (saved && !saved.state.stopped) {
        if (hookEvent.hook_event_name === 'UserPromptSubmit') output = { decision: 'block', reason: message }
        if (hookEvent.hook_event_name === 'PreToolUse')
          output = {
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: message,
            },
          }
      }
    }
    console.log(JSON.stringify(output))
  } else {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
})
