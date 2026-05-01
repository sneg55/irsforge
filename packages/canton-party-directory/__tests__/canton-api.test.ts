import { describe, expect, test, vi } from 'vitest'
import { fetchParties } from '../src/canton-api'

describe('fetchParties', () => {
  test('parses Canton /v1/parties response into PartyEntry array', async () => {
    const mockResponse = {
      result: [
        { identifier: 'PartyA::1220abc', displayName: 'PartyA', isLocal: true },
        { identifier: 'PartyB::1220abc', displayName: 'PartyB', isLocal: true },
      ],
      status: 200,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }),
    )

    const entries = await fetchParties({ ledgerUrl: 'http://localhost:7575', token: 'test-token' })

    expect(entries).toEqual([
      { identifier: 'PartyA::1220abc', displayName: 'PartyA', hint: 'PartyA' },
      { identifier: 'PartyB::1220abc', displayName: 'PartyB', hint: 'PartyB' },
    ])
    expect(fetch).toHaveBeenCalledWith('http://localhost:7575/v1/parties', {
      headers: { Authorization: 'Bearer test-token' },
    })

    vi.unstubAllGlobals()
  })

  test('uses proxyUrl when provided', async () => {
    const mockResponse = { result: [], status: 200 }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }),
    )

    await fetchParties({ proxyUrl: '/api/ledger', token: 'test-token' })

    expect(fetch).toHaveBeenCalledWith('/api/ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ path: '/v1/parties', body: {} }),
    })

    vi.unstubAllGlobals()
  })

  test('resolves token getter before fetching', async () => {
    const mockResponse = { result: [], status: 200 }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }),
    )

    const tokenGetter = vi.fn().mockResolvedValue('dynamic-token')
    await fetchParties({ ledgerUrl: 'http://localhost:7575', token: tokenGetter })

    expect(tokenGetter).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith('http://localhost:7575/v1/parties', {
      headers: { Authorization: 'Bearer dynamic-token' },
    })

    vi.unstubAllGlobals()
  })

  test('returns empty array on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const entries = await fetchParties({ ledgerUrl: 'http://localhost:7575', token: 'test' })
    expect(entries).toEqual([])
    vi.unstubAllGlobals()
  })

  test('returns empty array on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    const entries = await fetchParties({ ledgerUrl: 'http://localhost:7575', token: 'test' })
    expect(entries).toEqual([])
    vi.unstubAllGlobals()
  })
})
