'use client'

import {
  type AttributionBreakdown,
  decompose,
  type PricingContext,
  type PricingSnapshot,
  type SwapConfig,
} from '@irsforge/shared-pricing'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CurveStreamEntry } from '@/shared/ledger/useCurveStream'
import { formatAmount, valueColorClass } from '../utils/format'
import { Sparkline } from './sparkline'

interface AttributionTabProps {
  swapConfig: SwapConfig | null
  pricingCtx: PricingContext | null
  curveHistory: CurveStreamEntry[]
  streamStatus: 'idle' | 'connecting' | 'open' | 'fallback'
}

type T0Mode = 'inception' | 'sessionOpen' | 'lastN'

const BUCKET_COLORS: Record<
  keyof Pick<AttributionBreakdown, 'carry' | 'roll' | 'curve' | 'basis' | 'fixing'>,
  string
> = {
  carry: '#22c55e',
  roll: '#3b82f6',
  curve: '#8b5cf6',
  basis: '#f59e0b',
  fixing: '#ef4444',
}

function toSnapshot(asOf: string, pricingCtx: PricingContext): PricingSnapshot {
  return {
    asOf,
    curve: { ...pricingCtx.curve, asOf },
    book: pricingCtx.book,
    index: pricingCtx.index,
    indicesByLeg: pricingCtx.indicesByLeg,
    fxSpots: pricingCtx.fxSpots,
  }
}

function snapshotFromEntry(entry: CurveStreamEntry, pricingCtx: PricingContext): PricingSnapshot {
  return {
    asOf: entry.curve.asOf,
    curve: entry.curve,
    book: pricingCtx.book,
    index: pricingCtx.index,
    indicesByLeg: pricingCtx.indicesByLeg,
    fxSpots: pricingCtx.fxSpots,
  }
}

function exportCsv(rows: (AttributionBreakdown & { asOf: string })[]) {
  const header = 'asOf,total,curve,basis,carry,roll,fixing,unexplained'
  const body = rows
    .map((r) =>
      [r.asOf, r.total, r.curve, r.basis, r.carry, r.roll, r.fixing, r.unexplained].join(','),
    )
    .join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `attribution-${new Date().toISOString()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function StatusBadge({ status }: { status: AttributionTabProps['streamStatus'] }) {
  const color = status === 'open' ? '#22c55e' : status === 'fallback' ? '#f59e0b' : '#555b6e'
  const label = status === 'open' ? 'Live' : status === 'fallback' ? 'Polling' : status
  return (
    <div className="flex items-center gap-1 text-[9px] font-mono">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span style={{ color }}>{label}</span>
    </div>
  )
}

export function AttributionTab({
  swapConfig,
  pricingCtx,
  curveHistory,
  streamStatus,
}: AttributionTabProps) {
  const sessionOpenRef = useRef<string>(new Date().toISOString())
  const [t0Mode, setT0Mode] = useState<T0Mode>('sessionOpen')
  const [lastN, setLastN] = useState(10)
  const [paused, setPaused] = useState(false)
  const [history, setHistory] = useState<(AttributionBreakdown & { asOf: string })[]>([])
  const lastDecomposedAsOf = useRef<string | null>(null)

  const latestEntry = curveHistory.length > 0 ? curveHistory[curveHistory.length - 1] : null

  const t0AsOf = useMemo(() => {
    if (!swapConfig) return null
    if (t0Mode === 'inception') return swapConfig.tradeDate.toISOString()
    if (t0Mode === 'sessionOpen') return sessionOpenRef.current
    const idx = Math.max(0, curveHistory.length - lastN - 1)
    return curveHistory[idx]?.curve.asOf ?? sessionOpenRef.current
  }, [swapConfig, t0Mode, lastN, curveHistory])

  useEffect(() => {
    if (paused || !swapConfig || !pricingCtx || !latestEntry || !t0AsOf) return
    const t1AsOf = latestEntry.curve.asOf
    if (t1AsOf === lastDecomposedAsOf.current) return
    try {
      const snap0 = toSnapshot(t0AsOf, pricingCtx)
      const snap1 = snapshotFromEntry(latestEntry, pricingCtx)
      const bd = decompose(swapConfig, snap0, snap1, [])
      setHistory((prev) => {
        const next = [...prev, { asOf: t1AsOf, ...bd }]
        return next.length > 60 ? next.slice(next.length - 60) : next
      })
      lastDecomposedAsOf.current = t1AsOf
    } catch {
      // pricer mismatch (e.g. book missing for XCCY) — skip this tick
    }
  }, [paused, swapConfig, pricingCtx, latestEntry, t0AsOf])

  const rebase = () => {
    sessionOpenRef.current = latestEntry?.curve.asOf ?? new Date().toISOString()
    lastDecomposedAsOf.current = null
    setHistory([])
    setT0Mode('sessionOpen')
  }

  if (!swapConfig || !pricingCtx) {
    return (
      <div className="p-3.5 text-3xs text-[#555b6e] font-mono">
        Attribution unavailable — oracle curve not loaded.
      </div>
    )
  }

  const latest = history.length > 0 ? history[history.length - 1] : null
  const bucketKeys: (keyof AttributionBreakdown)[] = ['carry', 'roll', 'curve', 'basis', 'fixing']
  // When the curve hasn't moved since t0, decompose legitimately returns
  // all-zero buckets for every recorded tick. Rendering "+0" rows in that
  // case looks identical to "waiting for data" — detect and distinguish.
  const curveStatic =
    history.length > 0 &&
    history.every(
      (h) =>
        h.carry === 0 &&
        h.roll === 0 &&
        h.curve === 0 &&
        h.basis === 0 &&
        h.fixing === 0 &&
        h.unexplained === 0,
    )

  return (
    <div className="p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[9px] font-semibold tracking-wider text-[#3b82f6]">
          <div className="w-[3px] h-2.5 rounded-sm bg-[#3b82f6]" />
          P&amp;L ATTRIBUTION
        </div>
        <StatusBadge status={streamStatus} />
      </div>

      <div className="flex gap-1 flex-wrap">
        {(['inception', 'sessionOpen', 'lastN'] as T0Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setT0Mode(m)}
            className={`px-1.5 py-0.5 text-[9px] font-mono rounded border ${
              m === t0Mode
                ? 'bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6]'
                : 'bg-[#111320] border-[#1e2235] text-[#8b8fa3] hover:text-white'
            }`}
          >
            {m === 'inception'
              ? 'Inception'
              : m === 'sessionOpen'
                ? 'Session open'
                : `Last ${lastN}`}
          </button>
        ))}
        {t0Mode === 'lastN' && (
          <input
            type="number"
            min={1}
            max={30}
            value={lastN}
            onChange={(e) => setLastN(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)))}
            className="w-12 bg-[#111320] text-white text-3xs rounded px-1 py-0.5 border border-[#1e2235] outline-hidden font-mono"
          />
        )}
      </div>

      {!latest && (
        <div className="text-3xs font-mono text-[#555b6e]">Waiting for curve stream tick…</div>
      )}

      {latest && curveStatic && (
        <div className="text-3xs font-mono text-[#555b6e]">
          Curve static since t0 — no P&amp;L to attribute yet.
        </div>
      )}

      {latest && !curveStatic && (
        <div className="space-y-1">
          {bucketKeys.map((k) => {
            const values = history.map((h) => h[k])
            return (
              <div
                key={k}
                className="grid grid-cols-[60px_1fr_80px] items-center gap-2 text-3xs font-mono"
              >
                <span className="text-[#8b8fa3] capitalize">{k}</span>
                <Sparkline
                  values={values}
                  width={96}
                  height={14}
                  stroke={BUCKET_COLORS[k as keyof typeof BUCKET_COLORS]}
                />
                <span className={`text-right ${valueColorClass(latest[k])}`}>
                  {formatAmount(latest[k])}
                </span>
              </div>
            )
          })}
          <div className="grid grid-cols-[60px_1fr_80px] items-center gap-2 text-3xs font-mono pt-1 border-t border-[#1e2235]">
            <span className="text-[#555b6e]">Unexp.</span>
            <Sparkline
              values={history.map((h) => h.unexplained)}
              width={96}
              height={14}
              stroke="#555b6e"
            />
            <span className="text-right text-[#555b6e]">{formatAmount(latest.unexplained)}</span>
          </div>
          <div className="grid grid-cols-[60px_1fr_80px] items-center gap-2 text-2xs font-mono pt-1 font-bold">
            <span className="text-white">Total</span>
            <span />
            <span className={`text-right ${valueColorClass(latest.total)}`}>
              {formatAmount(latest.total)}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={() => setPaused((p) => !p)}
          className="flex-1 py-1 bg-[#1e2235] text-white rounded text-3xs font-semibold hover:bg-[#2a3050]"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={rebase}
          className="flex-1 py-1 bg-[#1e2235] text-white rounded text-3xs font-semibold hover:bg-[#2a3050]"
        >
          Rebase
        </button>
        <button
          onClick={() => exportCsv(history)}
          disabled={history.length === 0}
          className="flex-1 py-1 bg-[#1e2235] text-white rounded text-3xs font-semibold hover:bg-[#2a3050] disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>
    </div>
  )
}

export { AttributionTabSkeleton } from './attribution-tab-skeleton'
