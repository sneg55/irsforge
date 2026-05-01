import { beforeEach, describe, expect, test } from 'vitest'
import { LedgerClient } from './client'
import {
  failText,
  makeDamlJwt,
  mockFetch,
  NAMESPACE,
  okJson,
  PARTY_A_FULL,
  PARTY_B_FULL,
} from './test-helpers'

let fetchMock: ReturnType<typeof mockFetch>

beforeEach(() => {
  fetchMock = mockFetch()
})

describe('LedgerClient constructor', () => {
  test('stores token and exposes via authToken', () => {
    const client = new LedgerClient('my-token')
    expect(client.authToken).toBe('my-token')
  })
})

describe('request proxy', () => {
  test('routes all requests through /api/ledger', async () => {
    const token = makeDamlJwt([PARTY_A_FULL])
    const client = new LedgerClient(token)

    fetchMock.mockResolvedValueOnce(okJson({ result: ['pkg-abc'] }))
    fetchMock.mockResolvedValueOnce(failText('validation error'))
    fetchMock.mockResolvedValueOnce(okJson({ result: [] }))

    await client.query('Swap.Proposal:SwapProposal')

    for (const call of fetchMock.mock.calls) {
      expect(call[0]).toBe('/api/ledger')
    }
  })

  test('includes Authorization header with Bearer token', async () => {
    const token = makeDamlJwt([PARTY_A_FULL])
    const client = new LedgerClient(token)

    fetchMock.mockResolvedValueOnce(okJson({ result: ['pkg-abc'] }))
    fetchMock.mockResolvedValueOnce(failText('validation error'))
    fetchMock.mockResolvedValueOnce(okJson({ result: [] }))

    await client.query('Swap.Proposal:SwapProposal')

    for (const call of fetchMock.mock.calls) {
      expect(call[1].headers.Authorization).toBe(`Bearer ${token}`)
    }
  })

  test('throws on non-ok response', async () => {
    const token = makeDamlJwt([PARTY_A_FULL])
    const client = new LedgerClient(token)

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    })

    await expect(client.listPackages()).rejects.toThrow('Ledger API error (500)')
  })
})

describe('resolvePartyId', () => {
  test('resolves hint from JWT actAs claims', async () => {
    const token = makeDamlJwt([PARTY_A_FULL, PARTY_B_FULL])
    const client = new LedgerClient(token)

    expect(await client.resolvePartyId('PartyA')).toBe(PARTY_A_FULL)
    expect(await client.resolvePartyId('PartyB')).toBe(PARTY_B_FULL)
  })

  test('resolves full identifier to itself', async () => {
    const token = makeDamlJwt([PARTY_A_FULL])
    const client = new LedgerClient(token)
    expect(await client.resolvePartyId(PARTY_A_FULL)).toBe(PARTY_A_FULL)
  })

  test('resolves PARTY_A format to PartyA', async () => {
    const token = makeDamlJwt([PARTY_A_FULL])
    const client = new LedgerClient(token)
    expect(await client.resolvePartyId('PARTY_A')).toBe(PARTY_A_FULL)
  })

  test('constructs full identifier for unknown hint using namespace', async () => {
    const token = makeDamlJwt([PARTY_A_FULL])
    const client = new LedgerClient(token)
    expect(await client.resolvePartyId('Operator')).toBe(`Operator::${NAMESPACE}`)
  })

  test('returns raw hint when JWT is invalid', async () => {
    const client = new LedgerClient('not-a-jwt')
    expect(await client.resolvePartyId('PartyA')).toBe('PartyA')
  })

  test('resolves from readAs claims too', async () => {
    const token = makeDamlJwt([], [PARTY_A_FULL])
    const client = new LedgerClient(token)
    expect(await client.resolvePartyId('PartyA')).toBe(PARTY_A_FULL)
  })

  test('caches partyMap across calls', async () => {
    const token = makeDamlJwt([PARTY_A_FULL])
    const client = new LedgerClient(token)
    await client.resolvePartyId('PartyA')
    await client.resolvePartyId('PartyA')
    expect(await client.resolvePartyId('PartyA')).toBe(PARTY_A_FULL)
  })
})

describe('X-Irsforge-Org header', () => {
  test('is omitted when orgId not provided', async () => {
    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]))
    fetchMock.mockResolvedValueOnce(okJson({ result: [] }))

    await client.query('Swap.Proposal:SwapProposal').catch(() => undefined)

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers['X-Irsforge-Org']).toBeUndefined()
  })

  test('is sent when orgId is provided', async () => {
    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]), 'goldman')
    fetchMock.mockResolvedValueOnce(okJson({ result: [] }))

    await client.query('Swap.Proposal:SwapProposal').catch(() => undefined)

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers['X-Irsforge-Org']).toBe('goldman')
  })
})
