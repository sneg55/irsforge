'use client'

import type { CurveDayCount, DiscountCurve, InterpolationMethod } from '@irsforge/shared-pricing'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLedger } from '@/shared/contexts/ledger-context'
import { type StreamPhase, streamPhase } from '@/shared/hooks/use-stream-phase'
import { useStreamedContracts } from '@/shared/hooks/use-streamed-contracts'
import { CURVE_SNAPSHOT_TEMPLATE_ID, CURVE_TEMPLATE_ID } from './template-ids'
import type { ContractResult } from './types'

// Bump when the persisted shape changes so stale entries are ignored
// rather than deserialized into a broken type.
const STORAGE_VERSION = 1
const STORAGE_PREFIX = 'irsforge:curve-stream-buffer'

interface StoredBuffer {
  version: number
  entries: CurveStreamEntry[]
}

function readStoredBuffer(key: string, capacity: number): CurveStreamEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredBuffer
    if (parsed?.version !== STORAGE_VERSION) return []
    if (!Array.isArray(parsed.entries)) return []
    return parsed.entries.slice(-capacity)
  } catch {
    return []
  }
}

function writeStoredBuffer(key: string, entries: CurveStreamEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    const payload: StoredBuffer = { version: STORAGE_VERSION, entries }
    window.localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // Quota exceeded, private mode, etc. — non-fatal; in-memory buffer
    // still drives the UI.
  }
}

interface CurvePayload {
  operator: string
  currency: string
  curveType: 'Discount' | 'Projection'
  indexId: string | null
  asOf: string
  pillars: Array<{ tenorDays: string; zeroRate: string }>
  interpolation: InterpolationMethod
  dayCount: CurveDayCount
  constructionMetadata: string
}

function toDiscountCurve(p: CurvePayload): DiscountCurve {
  return {
    currency: p.currency,
    curveType: p.curveType,
    indexId: p.indexId,
    asOf: p.asOf,
    pillars: p.pillars.map((x) => ({
      tenorDays: parseInt(x.tenorDays, 10),
      zeroRate: parseFloat(x.zeroRate),
    })),
    interpolation: p.interpolation,
    dayCount: p.dayCount,
  }
}

export interface CurveStreamEntry {
  curve: DiscountCurve
  receivedAt: string
}

const DEFAULT_CAPACITY = 512
const POLL_INTERVAL_MS = 10_000

export function useCurveStream(
  currency: string,
  curveType: 'Discount' | 'Projection',
  indexId?: string,
  capacity: number = DEFAULT_CAPACITY,
) {
  const { client, activeOrg } = useLedger()
  // Stable per-stream localStorage key so a full page reload rehydrates
  // the sparkline instantly, before the CurveSnapshot query resolves.
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${currency}:${curveType}:${indexId ?? ''}`,
    [currency, curveType, indexId],
  )
  // Live deltas since mount. Merged with the snapshot history below so
  // a nav-away-and-back (or a fresh page load) still shows a real trend
  // line rather than the single-point dot the ACS alone provides.
  // Lazy initializer reads localStorage once — the subsequent write
  // effect keeps it in sync on every buffer update.
  const [liveBuffer, setLiveBuffer] = useState<CurveStreamEntry[]>(() =>
    readStoredBuffer(storageKey, capacity),
  )
  const [fallback, setFallback] = useState(false)
  const lastSeenContractId = useRef<string | null>(null)

  useEffect(() => {
    writeStoredBuffer(storageKey, liveBuffer)
  }, [storageKey, liveBuffer])

  // Historical hydration from the append-only CurveSnapshot template.
  // React Query's cache (staleTime: Infinity) persists the snapshot set
  // across remounts so switching tabs doesn't reset the sparkline.
  // `client?.authToken` in the key splits cache by participant — a JWT
  // swap must re-query or we'd leak one party's snapshots to another.
  const { data: snapshotHistory = [] } = useQuery<CurveStreamEntry[]>({
    queryKey: ['curve-snapshot-history', currency, curveType, indexId ?? null, client?.authToken],
    queryFn: async () => {
      if (!client) return []
      const rows = await client.query<ContractResult<CurvePayload>>(CURVE_SNAPSHOT_TEMPLATE_ID)
      const wantIndex = indexId ?? null
      const entries: CurveStreamEntry[] = rows
        .filter((r) => r.payload.currency === currency)
        .filter((r) => r.payload.curveType === curveType)
        .filter((r) => (r.payload.indexId ?? null) === wantIndex)
        .map((r) => ({
          curve: toDiscountCurve(r.payload),
          receivedAt: r.payload.asOf,
        }))
      entries.sort((a, b) => a.curve.asOf.localeCompare(b.curve.asOf))
      return entries.slice(-capacity)
    },
    enabled: !!client,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const push = useCallback(
    (curve: DiscountCurve) => {
      if (curve.currency !== currency) return
      if (curve.curveType !== curveType) return
      const wantIndex = indexId ?? null
      const gotIndex = curve.indexId ?? null
      if (wantIndex !== gotIndex) return
      setLiveBuffer((prev) => {
        const next = [...prev, { curve, receivedAt: new Date().toISOString() }]
        return next.length > capacity ? next.slice(next.length - capacity) : next
      })
    },
    [currency, curveType, indexId, capacity],
  )

  const { status, lastError } = useStreamedContracts<CurvePayload>({
    templateId: CURVE_TEMPLATE_ID,
    enabled: !!client && !!activeOrg && !fallback,
    onCreated: (payload, cid) => {
      if (cid === lastSeenContractId.current) return
      lastSeenContractId.current = cid
      push(toDiscountCurve(payload))
    },
    onClose: () => setFallback(true),
  })

  useQuery({
    queryKey: ['curve-stream-poll', currency, curveType, indexId ?? null, client?.authToken],
    queryFn: async () => {
      if (!client) return null
      const results = await client.query<ContractResult<CurvePayload>>(CURVE_TEMPLATE_ID)
      for (const r of results) {
        if (r.contractId === lastSeenContractId.current) continue
        const c = toDiscountCurve(r.payload)
        push(c)
        lastSeenContractId.current = r.contractId
      }
      return null
    },
    enabled: !!client && fallback,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
  })

  // Merge snapshot history with live deltas. Dedupe by curve.asOf so
  // the first live tick after hydration doesn't double-count a snapshot
  // we already have.
  const history = useMemo(() => {
    const seen = new Set<string>()
    const merged: CurveStreamEntry[] = []
    for (const entry of snapshotHistory) {
      if (seen.has(entry.curve.asOf)) continue
      seen.add(entry.curve.asOf)
      merged.push(entry)
    }
    for (const entry of liveBuffer) {
      if (seen.has(entry.curve.asOf)) continue
      seen.add(entry.curve.asOf)
      merged.push(entry)
    }
    merged.sort((a, b) => a.curve.asOf.localeCompare(b.curve.asOf))
    return merged.length > capacity ? merged.slice(-capacity) : merged
  }, [snapshotHistory, liveBuffer, capacity])

  const latest = history.length > 0 ? history[history.length - 1].curve : null
  const effectiveStatus: 'idle' | 'connecting' | 'open' | 'fallback' = fallback
    ? 'fallback'
    : (status as 'idle' | 'connecting' | 'open')
  const phase: StreamPhase = streamPhase(effectiveStatus, history.length > 0)
  return {
    latest,
    history,
    status: effectiveStatus,
    phase,
    lastError,
  }
}
