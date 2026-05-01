'use client'

import type { RateObservation } from '@irsforge/shared-pricing'
import { useQuery } from '@tanstack/react-query'
import { useLedger } from '@/shared/contexts/ledger-context'
import { OBSERVATION_TEMPLATE_ID } from './template-ids'
import type { ContractResult } from './types'

/**
 * On-chain shape of `Daml.Finance.Data.V4.Numeric.Observation:Observation`.
 *
 * The `id` field is the Daml `Id` newtype, which over JSON arrives as
 * `{ unpack: string }`. The `observations` field is a `Map Time Decimal`
 * which the JSON API v1 serializes as `[[time, value], ...]` (NOT a
 * record) — see CLAUDE memory `feedback_canton_json_api_v1_maps`.
 */
interface ObservationPayload {
  id: { unpack: string }
  observations: [string, string][]
}

/**
 * React Query hook that reads every on-chain `Observation` contract
 * whose `id` matches `indexId` and flattens them into a single sorted
 * `RateObservation[]`. Returns `[]` when no contract matches yet.
 *
 * The pricer iterates this list directly — no off-chain calendar — so
 * the publication schedule is implicitly whatever the oracle wrote.
 */
export function useObservations(indexId: string | null) {
  const { client } = useLedger()

  return useQuery<RateObservation[]>({
    queryKey: ['observations', indexId, client?.authToken],
    queryFn: async () => {
      if (!client || !indexId) return []
      const results =
        await client.query<ContractResult<ObservationPayload>>(OBSERVATION_TEMPLATE_ID)
      const matches = results.filter((r) => r.payload.id.unpack === indexId)
      const flat: RateObservation[] = []
      for (const r of matches) {
        for (const [t, v] of r.payload.observations) {
          flat.push({ date: new Date(t), rate: parseFloat(v) })
        }
      }
      flat.sort((a, b) => a.date.getTime() - b.date.getTime())
      return flat
    },
    enabled: !!client && !!indexId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
