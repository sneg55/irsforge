// Pure mapping helpers shared across per-family replay decoders. Family-
// specific SwapConfig builders live alongside in replay-decode-{irs,
// basis,xccy,cds,fpml}.ts.

import type {
  DiscountCurve,
  FloatingRateCompounding,
  FloatingRateFamily,
  FloatingRateIndex,
  RateObservation,
} from '@irsforge/shared-pricing'
import { mapDayCount } from '@irsforge/shared-pricing'
import type { CurvePayload, IndexPayload, ObservationPayload } from './replay-types.js'

export { mapDayCount }

export function toDiscountCurve(p: CurvePayload): DiscountCurve {
  return {
    currency: p.currency,
    curveType: p.curveType,
    indexId: p.indexId,
    asOf: p.asOf,
    pillars: p.pillars.map((q) => ({
      tenorDays: parseInt(q.tenorDays, 10),
      zeroRate: parseFloat(q.zeroRate),
    })),
    interpolation: p.interpolation,
    dayCount: p.dayCount,
  }
}

export function toFloatingRateIndex(p: IndexPayload): FloatingRateIndex {
  return {
    indexId: p.indexId,
    currency: p.currency,
    family: p.family as FloatingRateFamily,
    compounding: p.compounding as FloatingRateCompounding,
    lookback: parseInt(p.lookback, 10),
    floor: p.floor !== null ? parseFloat(p.floor) : null,
  }
}

export function flattenObservations(
  rows: Array<{ contractId: string; payload: ObservationPayload }>,
  indexId: string,
  cutoffIso: string,
): RateObservation[] {
  const cutoff = new Date(cutoffIso).getTime()
  const flat: RateObservation[] = []
  for (const r of rows) {
    if (r.payload.id.unpack !== indexId) continue
    for (const [t, v] of r.payload.observations) {
      const date = new Date(t)
      if (date.getTime() > cutoff) continue
      flat.push({ date, rate: parseFloat(v) })
    }
  }
  flat.sort((a, b) => a.date.getTime() - b.date.getTime())
  return flat
}
