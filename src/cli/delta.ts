import { run, stream, deadline, type Runner, type Stream } from '../core/process.ts'
import { isJsonObject } from '../core/json.ts'
import {
  commandErrorFromEnvelope,
  DeltaCommandError,
  parseThreadContract,
  contractRefusal,
  contractVersion,
  parseThreadStatus,
  SOURCE,
  PRODUCER_NAME,
} from './thread-commands.ts'

export class Delta {
  constructor(
    readonly executable = process.env.DELTA_CODEX_DELTA_BIN || 'delta',
    readonly runner: Runner = run,
  ) {}
  async command(args: string[], input?: string) {
    const value = await this.query(args, input)
    if (!isJsonObject(value)) throw new Error('Delta returned an invalid response')
    return value
  }
  async query(args: string[], input?: string): Promise<unknown> {
    const result = await this.runner([this.executable, '--json', ...args], {
      input,
      timeout: args[0] === 'update' ? 660_000 : 120_000,
      ...(args[0] === 'update' || (args[0] === 'auth' && args[1] === 'login')
        ? {
            onStderr: (text: string) => {
              process.stderr.write(text)
            },
          }
        : {}),
    })
    let value: unknown
    try {
      value = JSON.parse(result.stdout)
    } catch {
      throw new Error(
        `Delta ${args.slice(0, 2).join(' ')} returned invalid JSON: ${result.stderr.slice(-1000)}`,
      )
    }
    const error = isJsonObject(value) ? commandErrorFromEnvelope(value.error) : undefined
    if (error) throw error
    if (result.code !== 0)
      throw new DeltaCommandError('process_failed', result.stderr || `Delta exited ${result.code}`, {
        retryable: true,
      })
    return value
  }
  async contract() {
    const range = parseThreadContract(JSON.stringify(await this.command(['thread', 'contract'])))
    const refusal = contractRefusal(range)
    if (refusal) throw new Error(refusal)
    return contractVersion(range)
  }
  async status(reference: string, session: string) {
    return parseThreadStatus(
      JSON.stringify(
        await this.command(['thread', 'status', reference, '--source', SOURCE, '--external-id', session]),
      ),
    )
  }
  async append(reference: string, session: string, local: boolean, input: string) {
    try {
      return await this.runner(
        [
          this.executable,
          '--json',
          'thread',
          'append',
          reference,
          '--source',
          SOURCE,
          '--external-id',
          session,
          '--producer-name',
          PRODUCER_NAME,
          ...(local ? ['--acknowledge', 'local'] : []),
        ],
        { input },
      )
    } catch (error) {
      throw new DeltaCommandError('process_failed', String(error), { retryable: true })
    }
  }
  watch(reference: string, session: string, onLine: (line: string) => void) {
    return stream(
      [
        this.executable,
        '--json',
        'thread',
        'watch',
        reference,
        '--source',
        SOURCE,
        '--external-id',
        session,
        '--participate',
        PRODUCER_NAME,
      ],
      onLine,
    )
  }
  async mount(args: string[]): Promise<{ value: any; process: Stream }> {
    const process = stream([this.executable, '--json', ...args])
    try {
      const value = await deadline(process.ready, 120_000, 'Delta mount')
      if (!isJsonObject(value)) throw new Error('Invalid mount response')
      const error = commandErrorFromEnvelope(value.error)
      if (error) throw error
      if (value.operation !== 'mounted') throw new Error('Delta did not confirm the mount')
      return { value, process }
    } catch (error) {
      await process.stop()
      throw error
    }
  }
}
