import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useLastTick } from '../use-last-tick'

const queryMock = vi.fn()

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({
    client: { authToken: 't', query: queryMock },
    activeParty: 'PA',
    partyDisplayName: 'Party A',
  }),
}))

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useLastTick', () => {
  it('returns the most-recent timestamp from MarkToMarket and NettedBatch', async () => {
    queryMock
      .mockResolvedValueOnce([{ contractId: 'm1', payload: { asOf: '2026-04-18T10:00:00Z' } }])
      .mockResolvedValueOnce([
        { contractId: 'b1', payload: { paymentTimestamp: '2026-04-18T10:01:00Z' } },
      ])
      .mockResolvedValueOnce([])
    const { result } = renderHook(() => useLastTick(), { wrapper: wrap })
    await waitFor(() => {
      expect(result.current?.toISOString()).toBe('2026-04-18T10:01:00.000Z')
    })
  })

  it('returns the mark timestamp when newer than batch timestamp', async () => {
    queryMock
      .mockResolvedValueOnce([
        { contractId: 'm1', payload: { asOf: '2026-04-18T10:05:00Z' } },
        { contractId: 'm2', payload: { asOf: '2026-04-18T10:10:00Z' } },
      ])
      .mockResolvedValueOnce([
        { contractId: 'b1', payload: { paymentTimestamp: '2026-04-18T10:01:00Z' } },
      ])
      .mockResolvedValueOnce([])
    const { result } = renderHook(() => useLastTick(), { wrapper: wrap })
    await waitFor(() => {
      expect(result.current?.toISOString()).toBe('2026-04-18T10:10:00.000Z')
    })
  })

  it('falls back to Curve.asOf when no marks/batches exist (fresh-sandbox case)', async () => {
    // Right after a demo reset, the first mark cycle hasn't fired yet
    // but the oracle has already published a curve. Without curve as a
    // signal source, the pill stayed on "Starting up" for ~60–90 s.
    queryMock
      .mockResolvedValueOnce([]) // marks
      .mockResolvedValueOnce([]) // batches
      .mockResolvedValueOnce([{ contractId: 'c1', payload: { asOf: '2026-04-18T10:00:30Z' } }])
    const { result } = renderHook(() => useLastTick(), { wrapper: wrap })
    await waitFor(() => {
      expect(result.current?.toISOString()).toBe('2026-04-18T10:00:30.000Z')
    })
  })

  it('returns the latest across all three sources', async () => {
    queryMock
      .mockResolvedValueOnce([{ contractId: 'm1', payload: { asOf: '2026-04-18T10:00:00Z' } }])
      .mockResolvedValueOnce([
        { contractId: 'b1', payload: { paymentTimestamp: '2026-04-18T10:01:00Z' } },
      ])
      .mockResolvedValueOnce([{ contractId: 'c1', payload: { asOf: '2026-04-18T10:02:30Z' } }])
    const { result } = renderHook(() => useLastTick(), { wrapper: wrap })
    await waitFor(() => {
      expect(result.current?.toISOString()).toBe('2026-04-18T10:02:30.000Z')
    })
  })

  it('returns null when no marks, batches, or curves exist', async () => {
    queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const { result } = renderHook(() => useLastTick(), { wrapper: wrap })
    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })
})
