'use client'

import type { KeyRateDv01Entry } from '@irsforge/shared-pricing'
import { formatAmount, valueColorClass } from '../utils/format'

function RowKrd({ entry }: { entry: KeyRateDv01Entry }) {
  const curveTag =
    entry.curveType === 'Discount' ? 'D' : `P${entry.indexId ? `:${entry.indexId}` : ''}`
  const label = `${entry.pillarTenorDays}d · ${curveTag} · ${entry.currency}`
  return (
    <>
      <span className="text-[#8b8fa3]">{label}</span>
      <span className={valueColorClass(entry.dv01)}>{formatAmount(entry.dv01)}</span>
    </>
  )
}

interface KrdTableProps {
  krds: KeyRateDv01Entry[]
  fullKrds?: KeyRateDv01Entry[]
  parallel: number
}

export function KrdTable({ krds, fullKrds, parallel }: KrdTableProps) {
  const sumSet = fullKrds ?? krds
  const totalKrd = sumSet.reduce((s, e) => s + e.dv01, 0)
  const identityOk = Math.abs(totalKrd - parallel) < 1e-6
  return (
    <div className="text-3xs font-mono">
      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
        {krds.map((e) => (
          <RowKrd
            key={`${e.currency}-${e.curveType}-${e.indexId ?? ''}-${e.pillarTenorDays}`}
            entry={e}
          />
        ))}
        <span className="text-[#8b8fa3] pt-1 border-t border-[#1e2235]">Σ / parallel DV01</span>
        <span className={`${valueColorClass(totalKrd)} pt-1 border-t border-[#1e2235]`}>
          {formatAmount(totalKrd)}
        </span>
      </div>
      {!identityOk && (
        <div className="text-[#f59e0b] text-[9px] mt-1">
          KRD Σ ≠ parallel DV01 (Δ={formatAmount(totalKrd - parallel)})
        </div>
      )}
    </div>
  )
}
