import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, test, vi } from 'vitest'
import { useCurveAt } from './useCurveAt'

const query = vi.fn()

vi.mock('../contexts/ledger-context', () => ({
  useLedger: () => ({
    client: { authToken: 'jwt-fake', query },
    activeParty: 'PartyA',
    partyDisplayName: 'A',
    activeOrg: null,
  }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

const payload = (asOf: string) => ({
  operator: 'Op',
  currency: 'USD',
  curveType: 'Discount' as const,
  indexId: null,
  asOf,
  pillars: [{ tenorDays: '91', zeroRate: '0.0431' }],
  interpolation: 'LinearZero' as const,
  dayCount: 'Act360' as const,
  constructionMetadata: '{}',
})

describe('useCurveAt', () => {
  test('returns the latest curve with asOf <= pinnedAsOf', async () => {
    query.mockResolvedValueOnce([
      { contractId: 'c1', payload: payload('2026-04-10T00:00:00Z') },
      { contractId: 'c2', payload: payload('2026-04-15T00:00:00Z') },
      { contractId: 'c3', payload: payload('2026-04-20T00:00:00Z') },
    ])
    const { result } = renderHook(
      () => useCurveAt('USD', 'Discount', undefined, '2026-04-17T00:00:00Z'),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.asOf).toBe('2026-04-15T00:00:00Z')
  })

  test('returns null when no curve predates pinnedAsOf', async () => {
    query.mockResolvedValueOnce([{ contractId: 'c1', payload: payload('2026-04-20T00:00:00Z') }])
    const { result } = renderHook(
      () => useCurveAt('USD', 'Discount', undefined, '2026-04-17T00:00:00Z'),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBeNull()
  })

  test('pinnedAsOf=null returns { data: null, isLoading: false }', () => {
    const { result } = renderHook(() => useCurveAt('USD', 'Discount', undefined, null), { wrapper })
    expect(result.current.data).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })
})
