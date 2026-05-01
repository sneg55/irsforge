'use client'

import { useEffect, useRef, useState } from 'react'
import { type LocalExerciseEvent, ledgerActivityBus } from '@/shared/ledger/activity-bus'
import type { LedgerActivityEvent, LedgerActivityFilter } from '../types'
import { templateIdMatchesPrefix } from '../utils'

export type { LedgerActivityEvent, LedgerActivityFilter } from '../types'

export interface UseLedgerActivityBufferOptions {
  bufferSize: number
  // When set, the buffer hydrates from `localStorage[persistKey]` on mount
  // and writes back (debounced) on every push. Lets the regulator timeline
  // survive a tab reload — without it, every reload starts the ring empty
  // and any event older than the live stream is invisible.
  //
  // STOPGAP. The production answer is offset-replay against Canton's
  // transaction stream from a persisted ledger offset (or, for true
  // multi-participant deployments, a server-side regulator indexer). See
  // followups.md / regulator-offset-replay.
  persistKey?: string
}

// Schema-version field stamped on every persisted blob. Bump this (and
// discard old entries) if the LedgerActivityEvent shape ever changes;
// loading mismatched data into typed React state breaks decoders silently.
const PERSIST_SCHEMA_VERSION = 1
const PERSIST_DEBOUNCE_MS = 300

interface PersistedBlob {
  version: number
  events: LedgerActivityEvent[]
}

function readPersisted(key: string | undefined, cap: number): LedgerActivityEvent[] {
  if (!key) return []
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PersistedBlob
    if (parsed?.version !== PERSIST_SCHEMA_VERSION) return []
    if (!Array.isArray(parsed.events)) return []
    return parsed.events.slice(0, cap)
  } catch {
    return []
  }
}

export interface LedgerActivityBufferHandle {
  events: LedgerActivityEvent[]
  push: (event: LedgerActivityEvent) => void
  clear: () => void
}

// Buffer primitive: subscribes to ledgerActivityBus for exercise events and
// exposes `push()` that upstream (stream hook, replay) uses to land create/
// archive events. Events are kept newest-first, capped at bufferSize. When
// `persistKey` is set, the ring round-trips through localStorage so the
// regulator timeline is reload-resilient.
export function useLedgerActivityBuffer(
  opts: UseLedgerActivityBufferOptions,
): LedgerActivityBufferHandle {
  const persistKeyRef = useRef(opts.persistKey)
  const bufferSizeRef = useRef(opts.bufferSize)
  bufferSizeRef.current = opts.bufferSize
  const [events, setEvents] = useState<LedgerActivityEvent[]>(() =>
    readPersisted(persistKeyRef.current, opts.bufferSize),
  )

  const push = useRef((event: LedgerActivityEvent) => {
    setEvents((prev) => {
      // Dedup create/archive on (kind, contractId): Canton's WS replays
      // initial-state contracts on every (re)open and the buffer also
      // hydrates from localStorage, so the same create can arrive twice on
      // reload. Two creates of the same cid is impossible on the ledger,
      // so the dedup is lossless. Exercise events are not deduped — a user
      // can legitimately retry the same choice.
      if (event.kind !== 'exercise') {
        for (const existing of prev) {
          if (existing.kind === event.kind && existing.contractId === event.contractId) {
            return prev
          }
        }
      }
      const next = [event, ...prev]
      if (next.length > bufferSizeRef.current) next.length = bufferSizeRef.current
      return next
    })
  }).current

  const clear = useRef(() => {
    setEvents([])
    const k = persistKeyRef.current
    if (k && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(k)
      } catch {
        // storage unavailable — nothing to clear from
      }
    }
  }).current

  useEffect(() => {
    return ledgerActivityBus.subscribe((evt: LocalExerciseEvent) => {
      push({
        kind: 'exercise',
        templateId: evt.templateId,
        contractId: evt.contractId,
        party: evt.actAs[0] ?? null,
        ts: evt.ts,
        choice: evt.choice,
        resultCid: evt.resultCid,
      })
    })
  }, [push])

  // Debounced persist on every events change. Coalesces rapid bursts (a
  // Settle creates many child contracts → push() fires N times) into a
  // single write. Quota errors are swallowed — best-effort persistence is
  // strictly an improvement over none.
  useEffect(() => {
    const key = persistKeyRef.current
    if (!key) return
    if (typeof window === 'undefined') return
    const t = setTimeout(() => {
      try {
        const blob: PersistedBlob = { version: PERSIST_SCHEMA_VERSION, events }
        window.localStorage.setItem(key, JSON.stringify(blob))
      } catch {
        // quota exceeded / storage disabled — drop the write
      }
    }, PERSIST_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [events])

  return { events, push, clear }
}

// Pure filter used by both the ledger page and the toast stack. Deny takes
// precedence over allow; empty allow means "everything passes allow stage".
// systemPrefixes hides scheduler/oracle/mark chatter unless `includeSystem`
// is true — only applied to create/archive kinds (exercise is always
// user-triggered in this architecture).
export function filterEvents(
  events: LedgerActivityEvent[],
  filter: LedgerActivityFilter,
): LedgerActivityEvent[] {
  return events.filter((e) => {
    if (filter.kinds && !filter.kinds.includes(e.kind)) return false
    if (filter.templateDeny?.some((p) => templateIdMatchesPrefix(e.templateId, p))) {
      return false
    }
    if (
      filter.templateAllow &&
      filter.templateAllow.length > 0 &&
      !filter.templateAllow.some((p) => templateIdMatchesPrefix(e.templateId, p))
    ) {
      return false
    }
    if (
      !filter.includeSystem &&
      e.kind !== 'exercise' &&
      filter.systemPrefixes?.some((p) => templateIdMatchesPrefix(e.templateId, p))
    ) {
      return false
    }
    if (filter.cidPrefix && !e.contractId.startsWith(filter.cidPrefix)) return false
    return true
  })
}
