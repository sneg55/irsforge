'use client'

import { useQuery } from '@tanstack/react-query'
import { useLedger } from '@/shared/contexts/ledger-context'
import { FX_SPOT_TEMPLATE_ID } from './template-ids'
import type { ContractResult } from './types'

interface FxSpotPayload {
  operator: string
  baseCcy: string
  quoteCcy: string
  rate: string
  asOf: string
}

/**
 * React Query hook reading every on-chain `Oracle.FxSpot` contract, keyed
 * `${baseCcy}${quoteCcy}` (e.g. "EURUSD") with parsed `rate`. Consumed by
 * the blotter's XCCY pricing context to translate per-leg PVs to the
 * reporting currency.
 *
 * Mirrors `useCurveBook`: 60s staleTime, no refetch on focus, returns
 * `{}` when the client isn't ready yet so consumers don't have to guard
 * for undefined.
 */
export function useFxSpots() {
  const { client } = useLedger()
  return useQuery<Record<string, number>>({
    queryKey: ['fx-spots', client?.authToken],
    queryFn: async () => {
      if (!client) return {}
      const rows = await client.query<ContractResult<FxSpotPayload>>(FX_SPOT_TEMPLATE_ID)
      const out: Record<string, number> = {}
      for (const r of rows) {
        out[`${r.payload.baseCcy}${r.payload.quoteCcy}`] = parseFloat(r.payload.rate)
      }
      return out
    },
    enabled: !!client,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
