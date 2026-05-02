'use client'

import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { pollIntervalWithBackoff } from '@/shared/ledger/poll-interval'
import {
  CURVE_TEMPLATE_ID,
  MARK_TEMPLATE_ID,
  NETTED_BATCH_TEMPLATE_ID,
} from '@/shared/ledger/template-ids'
import type { ContractResult, MarkToMarketPayload, NettedBatchPayload } from '@/shared/ledger/types'

const POLL_INTERVAL_MS = 10_000

interface CurvePayload {
  asOf: string
}

// Phase 6 Stage B — derive scheduler liveness from on-chain activity.
//
// Returns the most-recent ISO timestamp from
//   - Oracle.Curve.asOf (every ~30 s, starts at boot — first signal
//     available after a fresh reset)
//   - MarkToMarket.asOf (every ~60 s when there are open CSAs)
//   - NettedBatch.paymentTimestamp (only when settlements happen)
// parsed as a Date. Returns `null` when none exist on chain — the
// caller (SchedulerStatusPill) renders a "starting up" state instead
// of a bogus 56-year staleness reading from treating the unix epoch
// as a real timestamp.
//
// Why include Curve: with only Mark/Batch, the pill stayed on
// "Starting up" for the first ~60–90 s after every demo reset because
// the first mark cycle hadn't fired yet. The oracle's curve republish
// is the same backend's earliest visible heartbeat, so folding it in
// flips the pill to OK within ~30 s of a fresh boot — closing the
// fresh-sandbox follow-up flagged in `reference_scheduler_authority`.
export function useLastTick(): Date | null {
  const { client } = useLedgerClient()
  // Holds the most-recent non-empty tick observed by this consumer.
  //
  // Why: in the post-restart window, Canton is reachable but oracle has
  // not yet republished any Curve/Mark/Batch. The query function then
  // returns null (legitimate empty result) which OVERWRITES the prior
  // good tick in React Query's cache — flipping the SchedulerStatusPill
  // back to "Starting up" even though we observed real activity moments
  // ago. Preserving the last-good value here keeps the UI stable across
  // those gaps; null is reserved for "never observed since mount" so the
  // pill's fresh-sandbox copy still works on a brand-new tab.
  const previousTickRef = useRef<number | null>(null)

  const { data } = useQuery({
    queryKey: ['scheduler-last-tick', client?.authToken],
    queryFn: async (): Promise<number | null> => {
      if (!client) return null
      const [marks, batches, curves] = await Promise.all([
        client.query<ContractResult<MarkToMarketPayload>>(MARK_TEMPLATE_ID),
        client.query<ContractResult<NettedBatchPayload>>(NETTED_BATCH_TEMPLATE_ID),
        client.query<ContractResult<CurvePayload>>(CURVE_TEMPLATE_ID),
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
      for (const c of curves) {
        const t = Date.parse(c.payload.asOf)
        if (Number.isFinite(t) && (latest === null || t > latest)) latest = t
      }
      return latest
    },
    enabled: !!client,
    refetchInterval: pollIntervalWithBackoff(POLL_INTERVAL_MS),
    refetchOnWindowFocus: false,
  })

  if (typeof data === 'number') {
    previousTickRef.current = data
    return new Date(data)
  }
  if (previousTickRef.current === null) return null
  return new Date(previousTickRef.current)
}
