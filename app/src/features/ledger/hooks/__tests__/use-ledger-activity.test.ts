import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ledgerActivityBus } from '@/shared/ledger/activity-bus'
import {
  filterEvents,
  type LedgerActivityEvent,
  useLedgerActivityBuffer,
} from '../use-ledger-activity'

describe('useLedgerActivityBuffer', () => {
  it('records events newest-first', () => {
    const { result } = renderHook(() => useLedgerActivityBuffer({ bufferSize: 10 }))
    act(() => {
      result.current.push({
        kind: 'create',
        templateId: 'T',
        contractId: '1',
        party: null,
        ts: 1,
      })
      result.current.push({
        kind: 'archive',
        templateId: 'T',
        contractId: '1',
        party: null,
        ts: 2,
      })
    })
    expect(result.current.events.map((e) => e.ts)).toEqual([2, 1])
  })

  it('caps buffer at bufferSize', () => {
    const { result } = renderHook(() => useLedgerActivityBuffer({ bufferSize: 2 }))
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.push({
          kind: 'create',
          templateId: 'T',
          contractId: String(i),
          party: null,
          ts: i,
        })
      }
    })
    expect(result.current.events).toHaveLength(2)
    expect(result.current.events.map((e) => e.contractId)).toEqual(['4', '3'])
  })

  it('dedups create/archive on (kind, contractId) — second push is a no-op', () => {
    const { result } = renderHook(() => useLedgerActivityBuffer({ bufferSize: 10 }))
    act(() => {
      result.current.push({
        kind: 'create',
        templateId: 'T',
        contractId: 'csa-1',
        party: null,
        ts: 1,
      })
      result.current.push({
        kind: 'create',
        templateId: 'T',
        contractId: 'csa-1',
        party: null,
        ts: 2,
      })
      // archive on same cid is a different kind — must NOT dedup
      result.current.push({
        kind: 'archive',
        templateId: 'T',
        contractId: 'csa-1',
        party: null,
        ts: 3,
      })
    })
    expect(result.current.events).toHaveLength(2)
    expect(result.current.events.map((e) => e.kind)).toEqual(['archive', 'create'])
    // First create wins (ts=1) — dedup keeps the existing entry
    expect(result.current.events.find((e) => e.kind === 'create')?.ts).toBe(1)
  })

  it('does not dedup exercise events — user can retry a choice', () => {
    const { result } = renderHook(() => useLedgerActivityBuffer({ bufferSize: 10 }))
    act(() => {
      ledgerActivityBus.emit({
        templateId: 'T',
        contractId: 'c',
        choice: 'X',
        actAs: ['Alice'],
        ts: 100,
      })
      ledgerActivityBus.emit({
        templateId: 'T',
        contractId: 'c',
        choice: 'X',
        actAs: ['Alice'],
        ts: 200,
      })
    })
    expect(result.current.events).toHaveLength(2)
  })

  it('receives exercise events from ledgerActivityBus', () => {
    const { result } = renderHook(() => useLedgerActivityBuffer({ bufferSize: 10 }))
    act(() => {
      ledgerActivityBus.emit({
        templateId: 'T',
        contractId: 'c',
        choice: 'X',
        actAs: ['Alice'],
        ts: 100,
      })
    })
    expect(result.current.events).toHaveLength(1)
    const e = result.current.events[0]
    expect(e.kind).toBe('exercise')
    expect(e.choice).toBe('X')
    expect(e.party).toBe('Alice')
  })
})

describe('useLedgerActivityBuffer — persistKey', () => {
  const KEY = 'test.ledger-activity'

  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.removeItem(KEY)
  })
  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.removeItem(KEY)
  })

  it('hydrates initial state from localStorage when persistKey set', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        events: [
          { kind: 'create', templateId: 'T', contractId: 'persisted-1', party: null, ts: 100 },
          { kind: 'archive', templateId: 'T', contractId: 'persisted-2', party: null, ts: 50 },
        ],
      }),
    )
    const { result } = renderHook(() =>
      useLedgerActivityBuffer({ bufferSize: 10, persistKey: KEY }),
    )
    expect(result.current.events.map((e) => e.contractId)).toEqual(['persisted-1', 'persisted-2'])
  })

  it('caps hydration to bufferSize', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        events: Array.from({ length: 10 }, (_, i) => ({
          kind: 'create' as const,
          templateId: 'T',
          contractId: String(i),
          party: null,
          ts: i,
        })),
      }),
    )
    const { result } = renderHook(() => useLedgerActivityBuffer({ bufferSize: 3, persistKey: KEY }))
    expect(result.current.events).toHaveLength(3)
  })

  it('discards persisted blob with mismatched schema version', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 999,
        events: [{ kind: 'create', templateId: 'T', contractId: 'old', party: null, ts: 1 }],
      }),
    )
    const { result } = renderHook(() =>
      useLedgerActivityBuffer({ bufferSize: 10, persistKey: KEY }),
    )
    expect(result.current.events).toEqual([])
  })

  it('persists events to localStorage on push (debounced)', async () => {
    const { result } = renderHook(() =>
      useLedgerActivityBuffer({ bufferSize: 10, persistKey: KEY }),
    )
    act(() => {
      result.current.push({
        kind: 'create',
        templateId: 'T',
        contractId: 'live-1',
        party: null,
        ts: 1,
      })
    })
    // Before debounce window — nothing written yet.
    expect(window.localStorage.getItem(KEY)).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    const blob = JSON.parse(window.localStorage.getItem(KEY) ?? 'null')
    expect(blob?.version).toBe(1)
    expect(blob?.events?.[0]?.contractId).toBe('live-1')
  })

  it('clear() empties the persisted blob too', async () => {
    const { result } = renderHook(() =>
      useLedgerActivityBuffer({ bufferSize: 10, persistKey: KEY }),
    )
    act(() => {
      result.current.push({
        kind: 'create',
        templateId: 'T',
        contractId: 'x',
        party: null,
        ts: 1,
      })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(window.localStorage.getItem(KEY)).not.toBeNull()
    act(() => result.current.clear())
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('omitting persistKey leaves localStorage untouched (back-compat)', async () => {
    const { result } = renderHook(() => useLedgerActivityBuffer({ bufferSize: 10 }))
    act(() => {
      result.current.push({
        kind: 'create',
        templateId: 'T',
        contractId: 'mem-only',
        party: null,
        ts: 1,
      })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })
})

describe('filterEvents', () => {
  const evts: LedgerActivityEvent[] = [
    { kind: 'create', templateId: 'A:Foo', contractId: '1', party: null, ts: 1 },
    { kind: 'archive', templateId: 'A:Bar', contractId: '2', party: null, ts: 2 },
    { kind: 'exercise', templateId: 'B:Baz', contractId: '3', party: null, ts: 3 },
  ]

  it('applies denylist by prefix', () => {
    const out = filterEvents(evts, { templateDeny: ['A:'] })
    expect(out.map((e) => e.templateId)).toEqual(['B:Baz'])
  })

  it('applies allowlist by prefix (non-empty)', () => {
    const out = filterEvents(evts, { templateAllow: ['A:'] })
    expect(out.map((e) => e.templateId)).toEqual(['A:Foo', 'A:Bar'])
  })

  it('filters by kind', () => {
    const out = filterEvents(evts, { kinds: ['create'] })
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('create')
  })
})
