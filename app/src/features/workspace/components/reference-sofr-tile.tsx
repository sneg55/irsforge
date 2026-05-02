'use client'
import type { DiscountCurve } from '@irsforge/shared-pricing'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Skeleton } from '@/components/ui/skeleton'
import type { CurveStreamEntry } from '@/shared/ledger/useCurveStream'
import { formatFloatRate } from '../utils/format'
import { ReferenceSofrPopover } from './reference-sofr-popover'

function tenorLabel(days: number): string {
  if (days < 30) return `${days}D`
  if (days < 365) return `${Math.round(days / 30)}M`
  return `${Math.round(days / 365)}Y`
}

function curveTitle(curve: DiscountCurve | null): string {
  const id = curve?.indexId
  if (!id) return 'Curve'
  // "USD-EFFR" → "EFFR", "EUR-ESTR" → "ESTR", "USD-SOFR-COMPOUND" → "SOFR"
  const parts = id.split('-')
  return `${parts[1] ?? parts[0]} Curve`
}

interface Props {
  curve: DiscountCurve | null
  history: CurveStreamEntry[]
}

function findPillar(curve: DiscountCurve | null, days: number) {
  if (!curve) return null
  const exact = curve.pillars.find((p) => p.tenorDays === days)
  if (exact) return exact
  return curve.pillars[Math.floor(curve.pillars.length / 2)] ?? null
}

const POPOVER_WIDTH = 320
// Approx rendered height — used only to decide flip direction, not to size the
// popover. Being pessimistic (too large) is safer than optimistic; an overly
// large estimate just favours the side with more room.
const POPOVER_HEIGHT_ESTIMATE = 220
const VIEWPORT_PAD = 8

export function ReferenceSofrTile({ curve, history }: Props) {
  const [open, setOpen] = useState(false)
  const tileRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (tileRef.current?.contains(t) || popoverRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const twoY = findPillar(curve, 730)
  const recent = history.slice(-20)
  const sparkVals = recent.map((e) => {
    const mid = Math.floor(e.curve.pillars.length / 2)
    return e.curve.pillars[mid]?.zeroRate ?? 0
  })
  const lo = sparkVals.length ? Math.min(...sparkVals) : 0
  const hi = sparkVals.length ? Math.max(...sparkVals) : 0
  const range = hi - lo || 1
  const sparkPath = sparkVals
    .map((v, i) => {
      const x = (i / Math.max(sparkVals.length - 1, 1)) * 120
      const y = 22 - ((v - lo) / range) * 18
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')

  const rect = tileRef.current?.getBoundingClientRect()
  // Compute position with viewport edge-detection so the popover never renders
  // off-screen when the tile sits near any viewport edge (the common case for
  // the right-rail reference strip). Falls back to 0/0 pre-mount; the portal
  // only renders after the first rect read, so the fallback is unused in practice.
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : POPOVER_WIDTH
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : POPOVER_HEIGHT_ESTIMATE
  const desiredLeft = rect?.left ?? 0
  const maxLeft = viewportW - POPOVER_WIDTH - VIEWPORT_PAD
  const clampedLeft = Math.max(VIEWPORT_PAD, Math.min(desiredLeft, maxLeft))
  const roomAbove = rect?.top ?? 0
  const roomBelow = viewportH - (rect?.bottom ?? 0)
  const openAbove = roomAbove >= POPOVER_HEIGHT_ESTIMATE + VIEWPORT_PAD || roomAbove > roomBelow
  const popoverTop = openAbove
    ? Math.max(VIEWPORT_PAD, (rect?.top ?? 0) - VIEWPORT_PAD - POPOVER_HEIGHT_ESTIMATE)
    : Math.min(
        viewportH - POPOVER_HEIGHT_ESTIMATE - VIEWPORT_PAD,
        (rect?.bottom ?? 0) + VIEWPORT_PAD,
      )

  return (
    <>
      <div
        ref={tileRef}
        data-testid="sofr-tile"
        onClick={() => setOpen((o) => !o)}
        className="flex-1 bg-[#0a0c12] px-3 py-2.5 cursor-pointer hover:bg-[#10131e]"
      >
        <div className="flex justify-between items-center mb-1">
          <span className="text-3xs font-semibold uppercase tracking-wider text-[#555b6e]">
            {curveTitle(curve)}
          </span>
          <span className="text-[#555b6e] text-3xs">↗</span>
        </div>
        <svg viewBox="0 0 120 26" className="w-full h-[26px]" preserveAspectRatio="none">
          {sparkPath && <path d={sparkPath} fill="none" stroke="#3b82f6" strokeWidth="1.4" />}
        </svg>
        <div className="flex justify-between text-3xs font-mono mt-1">
          <span className="text-[#c9c9d4]">{twoY ? tenorLabel(twoY.tenorDays) : '—'}</span>
          <span className="text-[#3b82f6]">{twoY ? formatFloatRate(twoY.zeroRate) : '—'}</span>
        </div>
      </div>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            data-testid="sofr-popover"
            className="fixed z-50"
            style={{ top: popoverTop, left: clampedLeft, width: POPOVER_WIDTH }}
          >
            <ReferenceSofrPopover curve={curve} history={history} />
          </div>,
          document.body,
        )}
    </>
  )
}

export function ReferenceSofrTileSkeleton() {
  return (
    <div className="flex-1 bg-[#0b0e17] px-4 py-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-6 w-28" />
      <Skeleton className="mt-1 h-3 w-24" />
    </div>
  )
}
