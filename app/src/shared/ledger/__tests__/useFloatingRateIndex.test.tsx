import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFloatingRateIndex, useFloatingRateIndices } from '../useFloatingRateIndex'
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

describe('useFloatingRateIndex', () => {
  beforeEach(() => {
    mockClient.query.mockReset()
  })

  it('returns parsed index when a match is found', async () => {
    mockClient.query.mockResolvedValueOnce([
      {
        contractId: 'c-1',
        payload: {
          indexId: 'USD-SOFR-COMPOUND',
          currency: 'USD',
          family: 'SOFR',
          compounding: 'Compounded',
          lookback: '2',
          floor: '0.0',
        },
      },
    ])
    const { result } = renderHook(() => useFloatingRateIndex('USD-SOFR-COMPOUND'), {
      wrapper: makeQueryWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toEqual({
      indexId: 'USD-SOFR-COMPOUND',
      currency: 'USD',
      family: 'SOFR',
      compounding: 'Compounded',
      lookback: 2,
      floor: 0,
    })
  })

  it('returns null when no registered index matches', async () => {
    mockClient.query.mockResolvedValueOnce([])
    const { result } = renderHook(() => useFloatingRateIndex('NONEXISTENT'), {
      wrapper: makeQueryWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('stays disabled when indexId is empty string', async () => {
    const { result } = renderHook(() => useFloatingRateIndex(''), {
      wrapper: makeQueryWrapper(),
    })
    // No fetch should happen — query is disabled.
    await new Promise((r) => setTimeout(r, 20))
    expect(mockClient.query).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('parses floor=null without throwing', async () => {
    mockClient.query.mockResolvedValueOnce([
      {
        contractId: 'c-2',
        payload: {
          indexId: 'EUR-ESTR',
          currency: 'EUR',
          family: 'ESTR',
          compounding: 'Compounded',
          lookback: '5',
          floor: null,
        },
      },
    ])
    const { result } = renderHook(() => useFloatingRateIndex('EUR-ESTR'), {
      wrapper: makeQueryWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.floor).toBeNull()
  })
})

describe('useFloatingRateIndices', () => {
  beforeEach(() => {
    mockClient.query.mockReset()
  })

  it('maps every registered index', async () => {
    mockClient.query.mockResolvedValueOnce([
      {
        contractId: 'c-1',
        payload: {
          indexId: 'USD-SOFR-COMPOUND',
          currency: 'USD',
          family: 'SOFR',
          compounding: 'Compounded',
          lookback: '2',
          floor: null,
        },
      },
      {
        contractId: 'c-2',
        payload: {
          indexId: 'EUR-ESTR',
          currency: 'EUR',
          family: 'ESTR',
          compounding: 'Compounded',
          lookback: '5',
          floor: '0.01',
        },
      },
    ])
    const { result } = renderHook(() => useFloatingRateIndices(), {
      wrapper: makeQueryWrapper(),
    })
    await waitFor(() => expect(result.current.data?.length).toBe(2))
    expect(result.current.data?.map((i) => i.indexId)).toEqual(['USD-SOFR-COMPOUND', 'EUR-ESTR'])
    expect(result.current.data?.[1].floor).toBe(0.01)
  })

  it('returns an empty list when none are registered', async () => {
    mockClient.query.mockResolvedValueOnce([])
    const { result } = renderHook(() => useFloatingRateIndices(), {
      wrapper: makeQueryWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})
