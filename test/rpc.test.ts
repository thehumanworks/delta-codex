import { test, expect } from 'vitest'
import { history, RpcError } from '../src/codex/rpc.ts'

test('history pages without a message cap and hydrates summary-only turns', async () => {
  const calls: string[] = []
  const rpc = {
    async call(method: string, params: any): Promise<any> {
      calls.push(method)
      if (method === 'thread/items/list')
        return { data: [{ item: { id: 'full', type: 'agentMessage', text: 'retained' } }], nextCursor: null }
      return params.cursor
        ? { data: [{ id: 'b', itemsView: 'summary', items: [] }], nextCursor: null }
        : { data: [{ id: 'a', itemsView: 'full', items: [] }], nextCursor: 'page2' }
    },
  }
  expect((await history(rpc, 's'))[1].items[0].text).toBe('retained')
  expect(calls).toEqual(['thread/turns/list', 'thread/turns/list', 'thread/items/list'])
})

test('legacy history fallback is limited to unsupported protocol errors', async () => {
  const rpc = {
    async call(method: string): Promise<any> {
      if (method === 'thread/turns/list') throw new RpcError(-32601, 'unsupported')
      return { thread: { turns: [{ id: 'old' }] } }
    },
  }
  expect(await history(rpc, 's')).toEqual([{ id: 'old' }])
  const broken = {
    async call(): Promise<any> {
      throw new Error('Connection lost')
    },
  }
  await expect(history(broken, 's')).rejects.toThrow('Connection lost')
})

test('repeating pagination cursors fail instead of looping forever', async () => {
  await expect(
    history(
      {
        async call(): Promise<any> {
          return { data: [], nextCursor: 'same' }
        },
      },
      's',
    ),
  ).rejects.toThrow('repeated')
})
