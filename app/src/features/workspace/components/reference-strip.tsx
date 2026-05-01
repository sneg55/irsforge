'use client'
import type { DiscountCurve } from '@irsforge/shared-pricing'
import type { CsaSummary } from '@/features/csa/hooks/use-csa-summary'
import type { CurveStreamEntry } from '@/shared/ledger/useCurveStream'
import { ReferenceCsaTile } from './reference-csa-tile'
import { ReferenceSofrTile, ReferenceSofrTileSkeleton } from './reference-sofr-tile'

interface Props {
  curve: DiscountCurve | null
  history: CurveStreamEntry[]
  cpty: string
  summary: CsaSummary
}

export function ReferenceStrip({ curve, history, cpty, summary }: Props) {
  return (
    <div className="flex gap-px bg-[#1e2235] border-b border-[#1e2235]">
      <ReferenceSofrTile curve={curve} history={history} />
      <ReferenceCsaTile cpty={cpty} summary={summary} />
    </div>
  )
}

export function ReferenceStripSkeleton() {
  return (
    <div className="flex gap-px bg-[#1e2235] border-b border-[#1e2235]">
      <ReferenceSofrTileSkeleton />
      <ReferenceSofrTileSkeleton />
    </div>
  )
}
