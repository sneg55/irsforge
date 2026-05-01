import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LedgerClient } from '../ledger-client.js'

describe('LedgerClient with tokenProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.LEDGER_HOST = 'localhost'
    process.env.LEDGER_PORT = '7575'
  })

  it('fetches token via provider on each request', async () => {
    let counter = 0
    const tokenProvider = vi.fn(() => Promise.resolve(`token-${++counter}`))
    // Each call must return a fresh Response — a consumed body can't be re-read.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ result: { contractId: 'cid-1' } }), { status: 200 }),
        ),
      )

    const client = new LedgerClient(tokenProvider)
    await client.create({ templateId: 'T', payload: {} })
    await client.create({ templateId: 'T', payload: {} })

    expect(tokenProvider).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer token-1' })
    expect(fetchSpy.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer token-2' })
  })

  it('still accepts a bare string token (legacy)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ result: { contractId: 'cid-1' } }), { status: 200 }),
        ),
      )
    const client = new LedgerClient('static-token')
    await client.create({ templateId: 'T', payload: {} })
    expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer static-token',
    })
  })
})
