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

  test('reconnects up to 5 times on abrupt close', () => {
    const onCreated = vi.fn()
    renderHook(() => useStreamedContracts({ templateId: 'Foo:Bar', onCreated, enabled: true }))
    expect(MockWebSocket.last).not.toBeNull()
    for (let i = 0; i < 5; i++) {
      act(() => {
        MockWebSocket.last!.forceClose(1006)
      })
      act(() => {
        vi.advanceTimersByTime(5000)
      })
    }
    const afterFifth = MockWebSocket.last!
    act(() => {
      afterFifth.forceClose(1006)
    })
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(MockWebSocket.last).toBe(afterFifth)
  })

  test('calls onClose after giving up', () => {
    const onClose = vi.fn()
    renderHook(() =>
      useStreamedContracts({ templateId: 'Foo:Bar', onCreated: vi.fn(), onClose, enabled: true }),
    )
    for (let i = 0; i < 6; i++) {
      act(() => {
        MockWebSocket.last!.forceClose(1006)
      })
      act(() => {
        vi.advanceTimersByTime(5000)
      })
    }
    expect(onClose).toHaveBeenCalled()
  })

  test('does not open when enabled=false', () => {
    MockWebSocket.last = null
    renderHook(() =>
      useStreamedContracts({ templateId: 'Foo:Bar', onCreated: vi.fn(), enabled: false }),
    )
    expect(MockWebSocket.last).toBeNull()
  })
})
