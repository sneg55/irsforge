import { afterEach, describe, expect, it, vi } from 'vitest'
import { LedgerClient } from '../ledger-client'

describe('LedgerClient.query', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends templateIds + optional query filter', async () => {
    const calls: RequestInit[] = []
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      calls.push(init)
      return new Response(JSON.stringify({ result: [] }), { status: 200 })
    })
    const client = new LedgerClient('tok')
    await client.query('Mod:Tpl', {
      rateId: 'SOFR/INDEX',
      effectiveDate: '2026-04-13',
    })
    const body = JSON.parse(calls[0].body as string)
    expect(body).toEqual({
      templateIds: ['Mod:Tpl'],
      query: { rateId: 'SOFR/INDEX', effectiveDate: '2026-04-13' },
    })
  })

  it('omits query field when no filter supplied', async () => {
    const calls: RequestInit[] = []
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      calls.push(init)
      return new Response(JSON.stringify({ result: [] }), { status: 200 })
    })
    const client = new LedgerClient('tok')
    await client.query('Mod:Tpl')
    const body = JSON.parse(calls[0].body as string)
    expect(body).toEqual({ templateIds: ['Mod:Tpl'] })
  })

  it('aborts after timeout on slow ledger', async () => {
    vi.stubGlobal(
      'fetch',
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }),
    )
    const client = new LedgerClient('tok', { timeoutMs: 20 })
    await expect(client.query('Mod:Tpl')).rejects.toThrow(/abort/i)
  })
})
