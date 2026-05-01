'use client'

import type { CurveDayCount, DiscountCurve, InterpolationMethod } from '@irsforge/shared-pricing'
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

export function useCurveAt(
  currency: string,
  curveType: 'Discount' | 'Projection',
  indexId: string | undefined,
  pinnedAsOf: string | null,
) {
  const { client } = useLedger()
  const q = useQuery<DiscountCurve | null>({
    queryKey: ['curve-at', currency, curveType, indexId ?? null, pinnedAsOf, client?.authToken],
    queryFn: async () => {
      if (!client || !pinnedAsOf) return null
      const results = await client.query<ContractResult<CurvePayload>>(CURVE_TEMPLATE_ID)
      const wantIndex = indexId ?? null
      const matches = results
        .map((r) => toDiscountCurve(r.payload))
        .filter(
          (c) =>
            c.currency === currency &&
            c.curveType === curveType &&
            (c.indexId ?? null) === wantIndex &&
            c.asOf <= pinnedAsOf,
        )
        .sort((a, b) => (a.asOf < b.asOf ? 1 : a.asOf > b.asOf ? -1 : 0))
      return matches.length > 0 ? matches[0] : null
    },
    enabled: !!client && !!pinnedAsOf,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  return {
    data: q.data ?? null,
    isLoading: q.isLoading,
    isPending: q.isPending,
    isFetching: q.isFetching,
    error: q.error ?? null,
    refetch: () => {
      void q.refetch()
    },
  }
}
