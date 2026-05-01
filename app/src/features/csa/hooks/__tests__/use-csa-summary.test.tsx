import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useCsaSummary } from '../use-csa-summary'

vi.mock('../use-csas', () => ({
  useCsas: () => ({
    data: [
      {
        contractId: 'csa1',
        operator: 'Op',
        partyA: 'PA-hint',
        partyB: 'PB-hint',
        regulators: ['Reg'],
        thresholdDirA: 0,
        thresholdDirB: 0,
        mta: 0,
        rounding: 0,
        valuationCcy: 'USD',
        postedByA: new Map([['USD', 5_000_000]]),
        postedByB: new Map([['USD', 3_000_000]]),
        state: 'Active' as const,
        lastMarkCid: null,
        activeDispute: null,
        isdaMasterAgreementRef: '',
        governingLaw: 'NewYork' as const,
        imAmount: 0,
      },
    ],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({
    client: { authToken: 't', query: vi.fn().mockResolvedValue([]) },
    activeParty: 'PA-hint',
    partyDisplayName: 'Party A',
  }),
}))

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useCsaSummary', () => {
  it('reports own + counterparty postings separately for PartyA', () => {
    const { result } = renderHook(() => useCsaSummary('PA-hint'), { wrapper: wrap })
    expect(result.current.ownPosted).toBe(5_000_000)
    expect(result.current.cptyPosted).toBe(3_000_000)
    expect(result.current.configured).toBe(true)
    expect(result.current.count).toBe(1)
  })

  it('flips ownPosted/cptyPosted when active party is PartyB', () => {
    const { result } = renderHook(() => useCsaSummary('PB-hint'), { wrapper: wrap })
    expect(result.current.ownPosted).toBe(3_000_000)
    expect(result.current.cptyPosted).toBe(5_000_000)
  })

  it('returns empty summary when active party not in any CSA', () => {
    const { result } = renderHook(() => useCsaSummary('OTHER'), { wrapper: wrap })
    expect(result.current.configured).toBe(false)
    expect(result.current.ownPosted).toBe(0)
    expect(result.current.cptyPosted).toBe(0)
    expect(result.current.count).toBe(0)
    expect(result.current.exposure).toBeNull()
  })

  it('returns empty summary when active party is null', () => {
    const { result } = renderHook(() => useCsaSummary(null), { wrapper: wrap })
    expect(result.current.count).toBe(0)
    expect(result.current.exposure).toBeNull()
  })

  it('exposure is null when no mark has been published (honest placeholder)', () => {
    const { result } = renderHook(() => useCsaSummary('PA-hint'), { wrapper: wrap })
    expect(result.current.exposure).toBeNull()
  })

  it('exposes regulator hints from the active party CSAs (deduped, sorted)', () => {
    const { result } = renderHook(() => useCsaSummary('PA-hint'), { wrapper: wrap })
    expect(result.current.regulatorHints).toEqual(['Reg'])
  })

  it('returns empty regulatorHints when active party not in any CSA', () => {
    const { result } = renderHook(() => useCsaSummary('OTHER'), { wrapper: wrap })
    expect(result.current.regulatorHints).toEqual([])
  })
})
