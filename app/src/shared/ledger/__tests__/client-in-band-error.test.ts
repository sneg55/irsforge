import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { LedgerClient } from '../client'
import { deriveHealth, ledgerHealthBus } from '../health-bus'
import { makeDamlJwt, mockFetch, okJson, PARTY_A_FULL } from '../test-helpers'

let fetchMock: ReturnType<typeof mockFetch>

beforeEach(() => {
  fetchMock = mockFetch()
  ledgerHealthBus.resetForTesting()
})

afterEach(() => {
  ledgerHealthBus.resetForTesting()
})

// Daml JSON API can return HTTP 200 OK with `{status: 500, errors: [...]}`
// in the body when the participant gRPC backend is UNAVAILABLE. The client
// must treat the in-band status as authoritative and not silently swallow
// the failure as if it were a successful empty result. Observed live on
// demo.irsforge.com 2026-05-02 with `Endpoints.ParticipantServerError:
// UNAVAILABLE: io exception` wrapped in HTTP 200 — the bug let
// `useLedgerHealth()` keep reading 'live' while every query came back empty.
describe('LedgerClient.request — in-band JSON API errors', () => {
  test('throws when body status >= 400 even if HTTP is 200', async () => {
    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]))
    fetchMock.mockResolvedValueOnce(
      okJson({
        errors: ['Endpoints.ParticipantServerError: UNAVAILABLE: io exception'],
        status: 500,
      }),
    )

    await expect(client.query('Swap.Proposal:SwapProposal')).rejects.toThrow(/500.*UNAVAILABLE/)
  })

  test('records the in-band failure on the health bus, not a success', async () => {
    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]))
    fetchMock.mockResolvedValueOnce(okJson({ errors: ['boom'], status: 500 }))

    await expect(client.query('Swap.Proposal:SwapProposal')).rejects.toThrow()

    const snap = ledgerHealthBus.getSnapshot()
    expect(snap.consecutiveFailures).toBe(1)
    expect(snap.lastFailureAt).not.toBeNull()
    expect(snap.lastSuccessAt).toBeNull()
  })

  test('three consecutive in-band failures flip health to down', async () => {
    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]))
    fetchMock.mockResolvedValue(okJson({ errors: ['boom'], status: 500 }))

    for (let i = 0; i < 3; i++) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: rejection asserted via expect chain below
      await client.query('Swap.Proposal:SwapProposal').catch(() => {})
    }

    expect(deriveHealth(ledgerHealthBus.getSnapshot())).toBe('down')
  })

  test('successful response with no `status` field still records success', async () => {
    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]))
    fetchMock.mockResolvedValueOnce(okJson({ result: [] }))

    await client.query('Swap.Proposal:SwapProposal')

    const snap = ledgerHealthBus.getSnapshot()
    expect(snap.consecutiveFailures).toBe(0)
    expect(snap.lastSuccessAt).not.toBeNull()
  })

  test('successful response with `status: 200` still records success', async () => {
    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]))
    fetchMock.mockResolvedValueOnce(okJson({ result: [], status: 200 }))

    await client.query('Swap.Proposal:SwapProposal')

    expect(deriveHealth(ledgerHealthBus.getSnapshot())).toBe('live')
  })
})
