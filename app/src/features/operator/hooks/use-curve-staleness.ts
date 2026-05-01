'use client'

import { useQuery } from '@tanstack/react-query'
import { useLedger } from '@/shared/contexts/ledger-context'
import { CURVE_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { ContractResult } from '@/shared/ledger/types'
import { CURVE_STALENESS_MINUTES } from '../constants'

const POLL_INTERVAL_MS = 30_000

export interface CurveStalenessEntry {
  ccy: string
  curveType: 'Discount' | 'Projection'
  indexId: string | null
  lastPublishedAt: Date
  ageMinutes: number
  stale: boolean
}

interface CurvePayload {
  currency: string
  curveType: 'Discount' | 'Projection'
  indexId: string | null
  asOf: string
}

export interface UseCurveStalenessResult {
  entries: CurveStalenessEntry[]
  error: Error | null
  refetch: () => void
}

/**
 * Derives per-curve staleness from the on-chain `Oracle.Curve:Curve` template.
 * Returns one entry per live curve contract, sorted by currency then curveType.
 * A curve is stale when its `asOf` is older than CURVE_STALENESS_MINUTES.
 */
export function useCurveStaleness(): UseCurveStalenessResult {
  const { client } = useLedger()

  const query = useQuery<CurveStalenessEntry[]>({
    queryKey: ['curve-staleness', client?.authToken],
    queryFn: async () => {
      if (!client) return []
      const results = await client.query<ContractResult<CurvePayload>>(CURVE_TEMPLATE_ID)
      const now = Date.now()
      const thresholdMs = CURVE_STALENESS_MINUTES * 60 * 1000

      return results.map((r) => {
        const lastPublishedAt = new Date(r.payload.asOf)
        const ageMs = now - lastPublishedAt.getTime()
        const ageMinutes = ageMs / 60_000

        return {
          ccy: r.payload.currency,
          curveType: r.payload.curveType,
          indexId: r.payload.indexId,
          lastPublishedAt,
          ageMinutes,
          stale: ageMs > thresholdMs,
        }
      })
    },
    enabled: !!client,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
  })

  return {
    entries: query.data ?? [],
    error: query.error ?? null,
    refetch: () => {
      void query.refetch()
    },
  }
}
