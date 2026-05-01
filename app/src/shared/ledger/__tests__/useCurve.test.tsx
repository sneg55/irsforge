import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurve } from '../useCurve'
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

const basePayload = {
  operator: 'Operator',
  currency: 'USD',
  curveType: 'Discount' as const,
  indexId: null,
  asOf: '2026-04-15T00:00:00Z',
  pillars: [
    { tenorDays: '91', zeroRate: '0.0431' },
    { tenorDays: '365', zeroRate: '0.0415' },
  ],
  interpolation: 'LinearZero' as const,
  dayCount: 'Act360' as const,
  constructionMetadata: '{}',
}

describe('useCurve', () => {
  beforeEach(() => {
    mockClient.query.mockReset()
  })

  it('parses matching discount curve and converts string decimals to numbers', async () => {
    mockClient.query.mockResolvedValueOnce([{ contractId: 'c-1', payload: basePayload }])
    const { result } = renderHook(() => useCurve('USD', 'Discount'), {
      wrapper: makeQueryWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toEqual({
      currency: 'USD',
      curveType: 'Discount',
      indexId: null,
      asOf: '2026-04-15T00:00:00Z',
      pillars: [
        { tenorDays: 91, zeroRate: 0.0431 },
        { tenorDays: 365, zeroRate: 0.0415 },
      ],
      interpolation: 'LinearZero',
      dayCount: 'Act360',
    })
  })

  it('returns null when no contract matches the currency/type', async () => {
    mockClient.query.mockResolvedValueOnce([
      { contractId: 'c-1', payload: { ...basePayload, currency: 'EUR' } },
    ])
    const { result } = renderHook(() => useCurve('USD', 'Discount'), {
      wrapper: makeQueryWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('returns null on empty result set', async () => {
    mockClient.query.mockResolvedValueOnce([])
    const { result } = renderHook(() => useCurve('USD', 'Discount'), {
      wrapper: makeQueryWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('filters projection curves by indexId when provided', async () => {
    mockClient.query.mockResolvedValueOnce([
      {
        contractId: 'c-a',
        payload: { ...basePayload, curveType: 'Projection', indexId: 'USD-SOFR' },
      },
      {
        contractId: 'c-b',
        payload: { ...basePayload, curveType: 'Projection', indexId: 'EUR-ESTR' },
      },
    ])
    const { result } = renderHook(() => useCurve('USD', 'Projection', 'USD-SOFR'), {
      wrapper: makeQueryWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.indexId).toBe('USD-SOFR')
  })

  it('stays disabled when currency is empty', async () => {
    const { result } = renderHook(() => useCurve('', 'Discount'), {
      wrapper: makeQueryWrapper(),
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(mockClient.query).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })
})
