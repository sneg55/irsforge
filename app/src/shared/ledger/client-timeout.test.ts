import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLIENT_TIMEOUT_MS, LedgerClient, setClientTimeoutForTesting } from './client'

const TOKEN =
  'header.' +
  btoa(JSON.stringify({ 'https://daml.com/ledger-api': { actAs: ['PartyA::ns'] } })) +
  '.sig'

describe('LedgerClient.request timeout', () => {
  afterEach(() => {
    setClientTimeoutForTesting(CLIENT_TIMEOUT_MS)
    vi.restoreAllMocks()
  })

  it('passes an AbortSignal into fetch init', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ result: [] }), { status: 200 }))
    const client = new LedgerClient(TOKEN)
    await client.listPackages()

    expect(fetchSpy).toHaveBeenCalled()
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('rejects with a timeout-class error when fetch never resolves', async () => {
    setClientTimeoutForTesting(50)
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as RequestInit).signal
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'TimeoutError'))
          })
        }),
    )

    const client = new LedgerClient(TOKEN)
    const start = Date.now()
    await expect(client.listPackages()).rejects.toSatisfy(
      (err: Error) => err.name === 'TimeoutError' || err.name === 'AbortError',
    )
    expect(Date.now() - start).toBeLessThan(500)
  })

  it('propagates non-2xx proxy errors unchanged', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":"Ledger timeout"}', {
        status: 504,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const client = new LedgerClient(TOKEN)
    await expect(client.listPackages()).rejects.toThrow(/Ledger API error \(504\)/)
  })
})
