import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { MarkToMarketPayload } from '@/shared/ledger/types'
import { useMarkStream } from '../use-mark-stream'

let onCreatedCb: ((payload: MarkToMarketPayload, cid: string) => void) | null = null

vi.mock('@/shared/hooks/use-streamed-contracts', () => ({
  useStreamedContracts: (opts: { onCreated: (p: MarkToMarketPayload, c: string) => void }) => {
    onCreatedCb = opts.onCreated
    return { status: 'open', lastError: null }
  },
}))

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({
    client: { authToken: 't', query: vi.fn() },
    activeParty: 'PA',
    partyDisplayName: 'Party A',
  }),
}))

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function makePayload(
  partyA: string,
  partyB: string,
  exposure: string,
  asOf: string,
  csaCid = 'csa-legacy-cid',
): MarkToMarketPayload {
  return {
    operator: 'Op',
    partyA,
    partyB,
    regulators: ['Reg'],
    scheduler: 'Sch',
    csaCid,
    asOf,
    exposure,
    snapshot: '{}',
  }
}

describe('useMarkStream', () => {
  it('appends matching marks into history (capped)', () => {
    const { result } = renderHook(() => useMarkStream('PA', 'PB', 4), { wrapper: wrap })
    expect(result.current.history).toHaveLength(0)
    act(() => {
      for (let i = 0; i < 6; i++) {
        onCreatedCb?.(
          makePayload('PA', 'PB', String(i * 1000), `2026-04-17T12:00:0${i}Z`),
          `markCid_${i}`,
        )
      }
    })
    expect(result.current.history).toHaveLength(4)
    expect(result.current.latest!.exposure).toBe(5000)
  })

  it('ignores marks for a different pair', () => {
    const { result } = renderHook(() => useMarkStream('PA', 'PB'), { wrapper: wrap })
    act(() => {
      onCreatedCb?.(makePayload('PA', 'OTHER', '1000', '2026-04-17T12:00:00Z'), 'm1')
      onCreatedCb?.(makePayload('OTHER', 'PB', '1000', '2026-04-17T12:00:00Z'), 'm2')
    })
    expect(result.current.history).toHaveLength(0)
  })

  it('matches regardless of stale csaCid (PublishMark/SettleVm lineage)', () => {
    const { result } = renderHook(() => useMarkStream('PA', 'PB'), { wrapper: wrap })
    act(() => {
      onCreatedCb?.(makePayload('PA', 'PB', '1000', '2026-04-17T12:00:00Z', 'cid-v1'), 'm1')
      onCreatedCb?.(makePayload('PA', 'PB', '2000', '2026-04-17T12:00:01Z', 'cid-v2'), 'm2')
    })
    expect(result.current.history).toHaveLength(2)
    expect(result.current.latest!.exposure).toBe(2000)
  })

  it('deduplicates marks by contractId', () => {
    const { result } = renderHook(() => useMarkStream('PA', 'PB'), { wrapper: wrap })
    act(() => {
      onCreatedCb?.(makePayload('PA', 'PB', '1000', '2026-04-17T12:00:00Z'), 'dup')
      onCreatedCb?.(makePayload('PA', 'PB', '1000', '2026-04-17T12:00:00Z'), 'dup')
    })
    expect(result.current.history).toHaveLength(1)
  })
})
