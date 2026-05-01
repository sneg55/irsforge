'use client'

import type {
  CurveBook,
  CurveDayCount,
  DiscountCurve,
  InterpolationMethod,
} from '@irsforge/shared-pricing'
import { useQuery } from '@tanstack/react-query'
import { useLedger } from '@/shared/contexts/ledger-context'
import { CURVE_TEMPLATE_ID } from './template-ids'
import type { ContractResult } from './types'

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

function toDiscountCurve(payload: CurvePayload): DiscountCurve {
  return {
    currency: payload.currency,
    curveType: payload.curveType,
    indexId: payload.indexId,
    asOf: payload.asOf,
    pillars: payload.pillars.map((p) => ({
      tenorDays: parseInt(p.tenorDays, 10),
      zeroRate: parseFloat(p.zeroRate),
    })),
    interpolation: payload.interpolation,
    dayCount: payload.dayCount,
  }
}

/**
 * Group every on-chain `Curve` contract by currency, pairing each currency's
 * discount curve with a map of projection curves (keyed by indexId) into a
 * `CurveBook`. Cross-currency strategies (XCCY) look up
 * `book.byCurrency[leg.currency]` to route per-leg; single-currency
 * strategies can ignore the book and stay on the primary
 * `PricingContext.curve`.
 *
 * Returns `null` while the first query is in flight. Any currency missing
 * either a discount row or at least one projection row is omitted — the UI
 * surfaces that as "N/A — curve missing for XXX" rather than falling back
 * silently.
 */
export function useCurveBook() {
  const { client } = useLedger()

  return useQuery<CurveBook | null>({
    queryKey: ['curve-book', client?.authToken],
    queryFn: async () => {
      if (!client) return null
      const results = await client.query<ContractResult<CurvePayload>>(CURVE_TEMPLATE_ID)

      type Accum = { discount?: DiscountCurve; projections: Record<string, DiscountCurve> }
      const byCurrency: Record<string, Accum> = {}
      let asOf: string | null = null

      for (const r of results) {
        const ccy = r.payload.currency
        const curve = toDiscountCurve(r.payload)
        asOf = asOf ?? curve.asOf
        if (!byCurrency[ccy]) byCurrency[ccy] = { projections: {} }
        if (curve.curveType === 'Discount') byCurrency[ccy].discount = curve
        else if (curve.curveType === 'Projection' && curve.indexId)
          byCurrency[ccy].projections[curve.indexId] = curve
      }

      const paired: CurveBook['byCurrency'] = {}
      for (const [ccy, pair] of Object.entries(byCurrency)) {
        if (pair.discount && Object.keys(pair.projections).length > 0) {
          paired[ccy] = { discount: pair.discount, projections: pair.projections }
        }
      }

      return { asOf: asOf ?? new Date().toISOString(), byCurrency: paired }
    },
    enabled: !!client,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
