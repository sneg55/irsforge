import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useCurveStream } from './useCurveStream'

class MockWebSocket {
  static last: MockWebSocket | null = null
  static OPEN = 1
  static CLOSED = 3
  url: string
  protocol: string
  readyState = 0
  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  sent: string[] = []
  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocol = Array.isArray(protocols) ? protocols.join(',') : (protocols ?? '')
    MockWebSocket.last = this
  }
  send(d: string) {
    this.sent.push(d)
  }
  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code: 1000, reason: '', wasClean: true } as CloseEvent)
  }
  acceptOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }
  push(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent)
  }
}

// Module-level query mock so individual tests can override what the
// snapshot hydration path and fallback poll see without re-mocking the
// whole context.
const mockClientQuery = vi.fn().mockResolvedValue([])

vi.mock('../contexts/ledger-context', () => ({
  useLedger: () => ({
    client: { authToken: 'jwt-fake', query: mockClientQuery },
    activeParty: 'PartyA',
    partyDisplayName: 'A',
    activeOrg: {
      id: 'goldman',
      party: 'PartyA',
      displayName: 'Goldman',
      hint: 'PartyA',
      ledgerUrl: 'http://localhost:7575',
    },
  }),
}))

const mkCurvePayload = (asOf: string, bump = 0) => ({
  operator: 'Op',
  currency: 'USD',
  curveType: 'Discount' as const,
  indexId: null,
  asOf,
  pillars: [
    { tenorDays: '91', zeroRate: String(0.0431 + bump) },
    { tenorDays: '365', zeroRate: String(0.0415 + bump) },
  ],
  interpolation: 'LinearZero' as const,
  dayCount: 'Act360' as const,
  constructionMetadata: '{}',
})

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('useCurveStream', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket)
    mockClientQuery.mockReset()
    mockClientQuery.mockResolvedValue([])
    // The hook now mirrors its liveBuffer to localStorage so a full
    // page reload rehydrates the sparkline. Clear per-test to keep
    // state assertions hermetic — a stale entry from a prior test
    // would leak into the next renderHook's initializer.
    if (typeof window !== 'undefined') window.localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    MockWebSocket.last = null
  })

  test('starts connecting then transitions to open after WS accepts', () => {
    const { result } = renderHook(() => useCurveStream('USD', 'Discount'), { wrapper })
    expect(result.current.status).toBe('connecting')
    act(() => {
      MockWebSocket.last!.acceptOpen()
    })
    expect(result.current.status).toBe('open')
  })

  test('appends parsed curves to history on push; latest tracks most recent', () => {
    const { result } = renderHook(() => useCurveStream('USD', 'Discount'), { wrapper })
    act(() => {
      MockWebSocket.last!.acceptOpen()
    })
    act(() => {
      MockWebSocket.last!.push({
        events: [
          { created: { contractId: 'c1', payload: mkCurvePayload('2026-04-15T00:00:00Z') } },
        ],
      })
    })
    expect(result.current.history).toHaveLength(1)
    expect(result.current.latest?.asOf).toBe('2026-04-15T00:00:00Z')
    act(() => {
      MockWebSocket.last!.push({
        events: [
          {
            created: { contractId: 'c2', payload: mkCurvePayload('2026-04-16T00:00:00Z', 0.0005) },
          },
        ],
      })
    })
    expect(result.current.history).toHaveLength(2)
    expect(result.current.latest?.asOf).toBe('2026-04-16T00:00:00Z')
  })

  test('ignores curves that do not match (currency, curveType, indexId)', () => {
    const { result } = renderHook(() => useCurveStream('USD', 'Discount'), { wrapper })
    act(() => {
      MockWebSocket.last!.acceptOpen()
    })
    act(() => {
      MockWebSocket.last!.push({
        events: [
          {
            created: {
              contractId: 'c1',
              payload: { ...mkCurvePayload('2026-04-15T00:00:00Z'), currency: 'EUR' },
            },
          },
        ],
      })
    })
    expect(result.current.history).toHaveLength(0)
    expect(result.current.latest).toBeNull()
  })

  test('ring-3 buffer caps at supplied capacity; oldest evicted first', () => {
    const { result } = renderHook(() => useCurveStream('USD', 'Discount', undefined, 3), {
      wrapper,
    })
    act(() => {
      MockWebSocket.last!.acceptOpen()
    })
    for (let i = 0; i < 5; i++) {
      act(() => {
        MockWebSocket.last!.push({
          events: [
            {
              created: {
                contractId: `c${i}`,
                payload: mkCurvePayload(`2026-04-1${5 + i}T00:00:00Z`),
              },
            },
          ],
        })
      })
    }
    expect(result.current.history).toHaveLength(3)
    expect(result.current.history[0].curve.asOf).toBe('2026-04-17T00:00:00Z')
    expect(result.current.latest?.asOf).toBe('2026-04-19T00:00:00Z')
  })

  test('hydrates history from CurveSnapshot query on mount, filtered by (currency, curveType, indexId)', async () => {
    mockClientQuery.mockResolvedValueOnce([
      // Matches (USD / Discount / no indexId) — seeded in order that should sort by asOf
      { contractId: 'snap-2', payload: mkCurvePayload('2026-04-15T00:00:00Z') },
      { contractId: 'snap-1', payload: mkCurvePayload('2026-04-14T00:00:00Z') },
      // Filtered out: EUR instead of USD
      {
        contractId: 'snap-eur',
        payload: { ...mkCurvePayload('2026-04-14T00:00:00Z'), currency: 'EUR' },
      },
      // Filtered out: Projection curveType
      {
        contractId: 'snap-proj',
        payload: { ...mkCurvePayload('2026-04-14T00:00:00Z'), curveType: 'Projection' },
      },
    ])

    const { result } = renderHook(() => useCurveStream('USD', 'Discount'), { wrapper })
    await waitFor(() => expect(result.current.history).toHaveLength(2))
    expect(result.current.history[0].curve.asOf).toBe('2026-04-14T00:00:00Z')
    expect(result.current.history[1].curve.asOf).toBe('2026-04-15T00:00:00Z')
  })

  test('persists liveBuffer to localStorage and rehydrates on the next mount', () => {
    const { unmount } = renderHook(() => useCurveStream('USD', 'Discount'), { wrapper })
    act(() => {
      MockWebSocket.last!.acceptOpen()
    })
    act(() => {
      MockWebSocket.last!.push({
        events: [
          { created: { contractId: 'c1', payload: mkCurvePayload('2026-04-15T00:00:00Z') } },
        ],
      })
    })
    act(() => {
      MockWebSocket.last!.push({
        events: [
          {
            created: { contractId: 'c2', payload: mkCurvePayload('2026-04-16T00:00:00Z', 0.0001) },
          },
        ],
      })
    })
    unmount()
    MockWebSocket.last = null

    // Remount with fresh WebSocket and snapshot query (returns []), so
    // any surviving history can only come from localStorage.
    const { result } = renderHook(() => useCurveStream('USD', 'Discount'), { wrapper })
    expect(result.current.history).toHaveLength(2)
    expect(result.current.history[0].curve.asOf).toBe('2026-04-15T00:00:00Z')
    expect(result.current.history[1].curve.asOf).toBe('2026-04-16T00:00:00Z')
  })

  test('dedupes between snapshot history and live stream by asOf', async () => {
    mockClientQuery.mockResolvedValueOnce([
      { contractId: 'snap-1', payload: mkCurvePayload('2026-04-14T00:00:00Z') },
    ])

    const { result } = renderHook(() => useCurveStream('USD', 'Discount'), { wrapper })
    await waitFor(() => expect(result.current.history).toHaveLength(1))

    // WS fires a duplicate (same asOf as the snapshot) followed by a genuinely new one.
    act(() => {
      MockWebSocket.last!.acceptOpen()
    })
    act(() => {
      MockWebSocket.last!.push({
        events: [
          { created: { contractId: 'live-dup', payload: mkCurvePayload('2026-04-14T00:00:00Z') } },
        ],
      })
    })
    act(() => {
      MockWebSocket.last!.push({
        events: [
          {
            created: {
              contractId: 'live-new',
              payload: mkCurvePayload('2026-04-15T00:00:00Z', 0.0001),
            },
          },
        ],
      })
    })

    expect(result.current.history).toHaveLength(2)
    expect(result.current.history[0].curve.asOf).toBe('2026-04-14T00:00:00Z')
    expect(result.current.history[1].curve.asOf).toBe('2026-04-15T00:00:00Z')
  })
})
