import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useObservations } from '../useObservations'
import { makeQueryWrapper } from './query-wrapper'

vi.mock('@/shared/ledger/generated/package-ids', () => ({
  IRSFORGE_PACKAGE_ID: 'test-irsforge-pkg',
  DAML_FINANCE_DATA_PACKAGE_ID: 'test-daml-finance-data-pkg',
  DAML_FINANCE_LIFECYCLE_PACKAGE_ID: 'test-daml-finance-lifecycle-pkg',
  DAML_FINANCE_HOLDING_PACKAGE_ID: 'test-daml-finance-holding-pkg',
  DAML_FINANCE_CLAIMS_PACKAGE_ID: 'test-daml-finance-claims-pkg',
  DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID: 'test-daml-finance-instrument-swap-pkg',
}))

const mockClient = { query: vi.fn(), authToken: 'tok-1' }
vi.mock('@/shared/contexts/ledger-context', () => ({
  useLedger: () => ({ client: mockClient }),
}))

describe('useObservations', () => {
  beforeEach(() => {
    mockClient.query.mockReset()
  })

  it('flattens every matching Observation contract into a sorted RateObservation list', async () => {
    mockClient.query.mockResolvedValueOnce([
      {
        contractId: 'c-1',
        payload: {
          id: { unpack: 'USD-SOFR' },
          observations: [
            ['2026-04-15T00:00:00Z', '0.0431'],
            ['2026-04-14T00:00:00Z', '0.0429'],
          ],
        },
      },
      {
        contractId: 'c-2',
        payload: {
          id: { unpack: 'USD-SOFR' },
          observations: [['2026-04-16T00:00:00Z', '0.0432']],
        },
      },
      {
        contractId: 'c-3',
        payload: {
          id: { unpack: 'EUR-ESTR' },
          observations: [['2026-04-16T00:00:00Z', '0.025']],
        },
      },
    ])
    const { result } = renderHook(() => useObservations('USD-SOFR'), {
      wrapper: makeQueryWrapper(),
    })
    await waitFor(() => expect(result.current.data?.length).toBe(3))
    const rates = result.current.data!
    // Sorted ascending by date.
    expect(rates[0].date.toISOString()).toBe('2026-04-14T00:00:00.000Z')
    expect(rates[2].date.toISOString()).toBe('2026-04-16T00:00:00.000Z')
    // parseFloat applied.
    expect(rates[0].rate).toBeCloseTo(0.0429)
    expect(rates[2].rate).toBeCloseTo(0.0432)
  })

  it('returns empty list when no contract matches the indexId', async () => {
    mockClient.query.mockResolvedValueOnce([
      {
        contractId: 'c-1',
        payload: {
          id: { unpack: 'EUR-ESTR' },
          observations: [['2026-04-15T00:00:00Z', '0.025']],
        },
      },
    ])
    const { result } = renderHook(() => useObservations('USD-SOFR'), {
      wrapper: makeQueryWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('stays disabled when indexId is null', async () => {
    const { result } = renderHook(() => useObservations(null), {
      wrapper: makeQueryWrapper(),
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(mockClient.query).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('returns empty list when no observations exist at all', async () => {
    mockClient.query.mockResolvedValueOnce([])
    const { result } = renderHook(() => useObservations('USD-SOFR'), {
      wrapper: makeQueryWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})
