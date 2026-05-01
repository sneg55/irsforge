import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- mocks (must be before dynamic import) ---

const mockQuery = vi.fn()

vi.mock('@/shared/contexts/ledger-context', () => ({
  useLedger: () => ({ client: { query: mockQuery, authToken: 'tok' } }),
}))

const { useCurveStaleness } = await import('../use-curve-staleness')

import { CURVE_STALENESS_MINUTES } from '../../constants'

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function makePayload(minsAgo: number, ccy = 'USD', indexId: string | null = null) {
  const asOf = new Date(Date.now() - minsAgo * 60 * 1000).toISOString()
  return {
    contractId: `cid-${ccy}-${minsAgo}`,
    payload: { currency: ccy, curveType: 'Discount' as const, indexId, asOf },
  }
}

beforeEach(() => {
  mockQuery.mockReset()
})

describe('useCurveStaleness', () => {
  it('returns stale:false for curve published 5m ago', async () => {
    mockQuery.mockResolvedValue([makePayload(5)])
    const { result } = renderHook(() => useCurveStaleness(), { wrapper: wrap })
    await waitFor(() => expect(result.current.entries.length).toBeGreaterThan(0))
    const entry = result.current.entries[0]
    expect(entry.stale).toBe(false)
    expect(entry.ageMinutes).toBeLessThan(CURVE_STALENESS_MINUTES)
  })

  it('returns stale:true for curve published 15m ago', async () => {
    mockQuery.mockResolvedValue([makePayload(15)])
    const { result } = renderHook(() => useCurveStaleness(), { wrapper: wrap })
    await waitFor(() => expect(result.current.entries.length).toBeGreaterThan(0))
    const entry = result.current.entries[0]
    expect(entry.stale).toBe(true)
    expect(entry.ageMinutes).toBeGreaterThan(CURVE_STALENESS_MINUTES)
  })

  it('returns per-curve staleness for multiple curves', async () => {
    mockQuery.mockResolvedValue([makePayload(5, 'USD'), makePayload(15, 'EUR')])
    const { result } = renderHook(() => useCurveStaleness(), { wrapper: wrap })
    await waitFor(() => expect(result.current.entries.length).toBe(2))

    const usd = result.current.entries.find((e) => e.ccy === 'USD')
    const eur = result.current.entries.find((e) => e.ccy === 'EUR')
    expect(usd?.stale).toBe(false)
    expect(eur?.stale).toBe(true)
  })

  it('exposes lastPublishedAt as a Date', async () => {
    mockQuery.mockResolvedValue([makePayload(3)])
    const { result } = renderHook(() => useCurveStaleness(), { wrapper: wrap })
    await waitFor(() => expect(result.current.entries.length).toBeGreaterThan(0))
    expect(result.current.entries[0].lastPublishedAt).toBeInstanceOf(Date)
  })
})
