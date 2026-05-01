import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStreamedEvents } from '../use-streamed-events'

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
  get lastSent(): unknown {
    if (this.sent.length === 0) return null
    return JSON.parse(this.sent[this.sent.length - 1])
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

describe('useStreamedEvents', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket)
    MockWebSocket.last = null
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    MockWebSocket.last = null
  })

  it('dispatches onCreated for created events', () => {
    const onCreated = vi.fn()
    const onArchived = vi.fn()
    renderHook(() =>
      useStreamedEvents({
        templateIds: ['T1'],
        onCreated,
        onArchived,
        enabled: true,
      }),
    )
    act(() => {
      MockWebSocket.last!.acceptOpen()
    })
    act(() => {
      MockWebSocket.last!.push({
        events: [{ created: { contractId: 'c1', payload: { x: 1 } } }],
      })
    })
    expect(onCreated).toHaveBeenCalledWith({ x: 1 }, 'c1', 'T1')
    expect(onArchived).not.toHaveBeenCalled()
  })

  it('dispatches onArchived for archived events', () => {
    const onCreated = vi.fn()
    const onArchived = vi.fn()
    renderHook(() =>
      useStreamedEvents({
        templateIds: ['T1'],
        onCreated,
        onArchived,
        enabled: true,
      }),
    )
    act(() => {
      MockWebSocket.last!.acceptOpen()
    })
    act(() => {
      MockWebSocket.last!.push({
        events: [{ archived: { contractId: 'c2', templateId: 'T1' } }],
      })
    })
    expect(onArchived).toHaveBeenCalledWith('c2', 'T1')
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('subscribes to multiple templateIds in one ws send', () => {
    renderHook(() =>
      useStreamedEvents({
        templateIds: ['T1', 'T2'],
        onCreated: vi.fn(),
        onArchived: vi.fn(),
        enabled: true,
      }),
    )
    act(() => {
      MockWebSocket.last!.acceptOpen()
    })
    expect(MockWebSocket.last!.lastSent).toEqual([{ templateIds: ['T1', 'T2'] }])
  })
})
