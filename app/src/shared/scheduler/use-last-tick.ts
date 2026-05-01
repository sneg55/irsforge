'use client'

import { useQuery } from '@tanstack/react-query'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { MARK_TEMPLATE_ID, NETTED_BATCH_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { ContractResult, MarkToMarketPayload, NettedBatchPayload } from '@/shared/ledger/types'

const POLL_INTERVAL_MS = 10_000

// Phase 6 Stage B — derive scheduler liveness from on-chain activity.
//
// Returns the most-recent ISO timestamp from MarkToMarket.asOf and
// NettedBatch.paymentTimestamp, parsed as a Date. Returns `null` when
// no marks or batches exist on chain — the caller (SchedulerStatusPill)
// renders a "starting up" state instead of a bogus 56-year staleness
// reading that comes from treating the unix epoch as a real timestamp.
export function useLastTick(): Date | null {
  const { client } = useLedgerClient()

  const { data } = useQuery({
    queryKey: ['scheduler-last-tick', client?.authToken],
    queryFn: async (): Promise<number | null> => {
      if (!client) return null
      const [marks, batches] = await Promise.all([
        client.query<ContractResult<MarkToMarketPayload>>(MARK_TEMPLATE_ID),
        client.query<ContractResult<NettedBatchPayload>>(NETTED_BATCH_TEMPLATE_ID),
      ])
      let latest: number | null = null
      for (const m of marks) {
        const t = Date.parse(m.payload.asOf)
        if (Number.isFinite(t) && (latest === null || t > latest)) latest = t
      }
      for (const b of batches) {
        const t = Date.parse(b.payload.paymentTimestamp)
        if (Number.isFinite(t) && (latest === null || t > latest)) latest = t
      }
      return latest
    },
    enabled: !!client,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
  })

  if (data === undefined || data === null) return null
  return new Date(data)
}
