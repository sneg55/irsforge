'use client'
import type { DiscountCurve } from '@irsforge/shared-pricing'
import { TENOR_DAYS_MAP } from '@irsforge/shared-pricing'
import type { CurveStreamEntry } from '@/shared/ledger/useCurveStream'
import { formatFloatRate } from '../utils/format'

interface Props {
  curve: DiscountCurve | null
  history: CurveStreamEntry[]
}

// Reverse lookup: tenorDays → short tenorLabel (e.g. 730 → "2Y"). Falls back
// to "${N}d" if no match, so exotic tenors still render something readable.
const LABEL_BY_DAYS = new Map<number, string>(
  Object.values(TENOR_DAYS_MAP).map((v) => [v.tenorDays, v.tenorLabel]),
)

function tenorLabel(days: number): string {
  return LABEL_BY_DAYS.get(days) ?? `${days}d`
}

function relativeTime(iso: string): string {
  const delta = Math.max(0, Date.now() - new Date(iso).getTime()) / 1000
  if (delta < 60) return `${Math.round(delta)}s ago`
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`
  return `${Math.round(delta / 3600)}h ago`
}

export function ReferenceSofrPopover({ curve, history }: Props) {
  if (!curve) {
    return <div className="p-3 text-[10px] text-[#555b6e]">Curve unavailable.</div>
  }
  return (
    <div className="bg-[#111320] border border-[#1e2235] rounded shadow-xl p-3 w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#3b82f6]">
          {curve.currency} {curve.curveType}
        </span>
        <span className="text-[9px] font-mono text-[#555b6e]">{relativeTime(curve.asOf)}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10px]">
        {curve.pillars.map((p, i) => (
          <div key={`${p.tenorDays}-${i}`} className="flex justify-between">
            <span className="text-[#8b8fa3]">{tenorLabel(p.tenorDays)}</span>
            <span className="text-white">{formatFloatRate(p.zeroRate)}</span>
          </div>
        ))}
      </div>
      <div className="text-[9px] text-[#555b6e] mt-2 font-mono">
        {history.length} ticks buffered
      </div>
    </div>
  )
}
