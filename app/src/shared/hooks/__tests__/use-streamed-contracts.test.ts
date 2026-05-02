import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useStreamedContracts } from '../use-streamed-contracts'

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
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code: 1000, reason: 'test close', wasClean: true } as CloseEvent)
  }
  acceptOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }
  push(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent)
  }
  forceClose(code = 1006) {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code, reason: 'abrupt', wasClean: false } as CloseEvent)
  }
}

vi.mock('../../contexts/ledger-context', () => ({
  useLedger: () => ({
    client: { authToken: 'jwt-fake' },
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

describe('useStreamedContracts', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    MockWebSocket.last = null
  })

  test('opens WS with derived ws:// URL and JWT subprotocol', () => {
    const onCreated = vi.fn()
    renderHook(() => useStreamedContracts({ templateId: 'Foo:Bar', onCreated, enabled: true }))
    const ws = MockWebSocket.last!
    expect(ws.url).toBe('ws://localhost:7575/v1/stream/query')
    expect(ws.protocol).toContain('jwt.token.jwt-fake')
    expect(ws.protocol).toContain('daml.ws.auth')
  })

  test('sends the template-ids query on open', () => {
    const onCreated = vi.fn()
    renderHook(() => useStreamedContracts({ templateId: 'Foo:Bar', onCreated, enabled: true }))
    act(() => {
      MockWebSocket.last!.acceptOpen()
    })
    expect(MockWebSocket.last!.sent[0]).toContain('"templateIds"')
    expect(MockWebSocket.last!.sent[0]).toContain('Foo:Bar')
  })

  test('dispatches CREATED events to onCreated', () => {
    const onCreated = vi.fn()
    renderHook(() =>
      useStreamedContracts<{ x: number }>({ templateId: 'Foo:Bar', onCreated, enabled: true }),
    )
    act(() => {
      MockWebSocket.last!.acceptOpen()
    })
    act(() => {
      MockWebSocket.last!.push({ events: [{ created: { contractId: 'c1', payload: { x: 1 } } }] })
    })
    expect(onCreated).toHaveBeenCalledWith({ x: 1 }, 'c1')
  })

  test('keeps reconnecting through transient closes within the 90s budget', () => {
    // Demo restarts last ~30-60s; the hook's retry budget is 90s of
    // wall-clock time (not an attempt count). Each forced close inside
    // the budget should produce a fresh socket.
    const onCreated = vi.fn()
    renderHook(() => useStreamedContracts({ templateId: 'Foo:Bar', onCreated, enabled: true }))
    expect(MockWebSocket.last).not.toBeNull()
    for (let i = 0; i < 8; i++) {
      const before = MockWebSocket.last
      act(() => {
        before!.forceClose(1006)
      })
      act(() => {
        // Backoff is capped at MAX_BACKOFF_MS=10_000, so 11s drains any
        // scheduled retry timer regardless of which attempt we're on.
        vi.advanceTimersByTime(11_000)
      })
      expect(MockWebSocket.last).not.toBe(before)
    }
  })

  test('falls back once the retry budget is exhausted', () => {
    const onClose = vi.fn()
    renderHook(() =>
      useStreamedContracts({ templateId: 'Foo:Bar', onCreated: vi.fn(), onClose, enabled: true }),
    )
    // 10 cycles * 11s = 110s > 90s budget — guaranteed exhaustion.
    for (let i = 0; i < 10; i++) {
      act(() => {
        MockWebSocket.last!.forceClose(1006)
      })
      act(() => {
        vi.advanceTimersByTime(11_000)
      })
    }
    expect(onClose).toHaveBeenCalled()
  })

  test('successful onopen resets the retry budget for the next outage', () => {
    // First disconnection burns ~60s of budget, then onopen succeeds.
    // A subsequent disconnection must get a full fresh budget — not the
    // remaining ~30s — so we never pin a long-lived tab on accumulated
    // age across independent outages.
    renderHook(() =>
      useStreamedContracts({ templateId: 'Foo:Bar', onCreated: vi.fn(), enabled: true }),
    )
    for (let i = 0; i < 6; i++) {
      const before = MockWebSocket.last
      act(() => {
        before!.forceClose(1006)
      })
      act(() => {
        vi.advanceTimersByTime(11_000)
      })
      expect(MockWebSocket.last).not.toBe(before)
    }
    // Cycle re-opens, resetting the budget.
    act(() => {
      MockWebSocket.last!.acceptOpen()
    })
    // Now another full ~80s of disconnection should still keep retrying.
    for (let i = 0; i < 7; i++) {
      const before = MockWebSocket.last
      act(() => {
        before!.forceClose(1006)
      })
      act(() => {
        vi.advanceTimersByTime(11_000)
      })
      expect(MockWebSocket.last).not.toBe(before)
    }
  })

  test('does not open when enabled=false', () => {
    MockWebSocket.last = null
    renderHook(() =>
      useStreamedContracts({ templateId: 'Foo:Bar', onCreated: vi.fn(), enabled: false }),
    )
    expect(MockWebSocket.last).toBeNull()
  })
})
