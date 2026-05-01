'use client'

import type { CurveDayCount, DiscountCurve, InterpolationMethod } from '@irsforge/shared-pricing'
import { useQuery } from '@tanstack/react-query'
import { useLedger } from '@/shared/contexts/ledger-context'
import { CURVE_TEMPLATE_ID } from './template-ids'
import type { ContractResult } from './types'

/**
 * On-chain payload shape of `Oracle.Curve:Curve`. Numeric fields (zero
 * rates, tenor-days counts) are emitted as strings by Canton's JSON API
 * for any Daml `Decimal` / `Int`, so parsing happens at the hook boundary
 * before the value hits the pricing engine.
 */
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
 * React Query hook that reads a single on-chain `Curve` contract matching
 * the requested `(currency, curveType, indexId)` triple. Returns `null`
 * when no contract matches yet (e.g. oracle hasn't published this curve
 * during the session) — consumers should treat `null` as "not available",
 * not as an error.
 *
 * `indexId` is optional:
 *   - pass `undefined` (or omit) to target the discount curve, which on
 *     chain has `indexId = None`;
 *   - pass a concrete index id (e.g. `"USD-SOFR-COMPOUND"`) to target
 *     the matching projection curve.
 *
 * Invalidation is keyed on `client?.authToken`, so a re-auth / org switch
 * refetches automatically. `useLedger()` does not currently expose a
 * post-action refetch nonce, so explicit invalidation after a publish
 * should go through `queryClient.invalidateQueries({ queryKey: ['curve'] })`.
 */
export function useCurve(currency: string, curveType: 'Discount' | 'Projection', indexId?: string) {
  const { client } = useLedger()

  return useQuery<DiscountCurve | null>({
    queryKey: ['curve', currency, curveType, indexId ?? null, client?.authToken],
    queryFn: async () => {
      if (!client) return null
      const results = await client.query<ContractResult<CurvePayload>>(CURVE_TEMPLATE_ID)
      const match = results.find(
        (r) =>
          r.payload.currency === currency &&
          r.payload.curveType === curveType &&
          (indexId ? r.payload.indexId === indexId : r.payload.indexId === null),
      )
      if (!match) return null
      return toDiscountCurve(match.payload)
    },
    enabled: !!client && !!currency,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
