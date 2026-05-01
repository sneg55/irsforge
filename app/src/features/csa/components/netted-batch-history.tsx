'use client'

import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { NETTED_BATCH_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { ContractResult, NettedBatchPayload } from '@/shared/ledger/types'

const POLL_INTERVAL_MS = 10_000

interface Props {
  csaCid: string
}

// Phase 6 Stage B — NettedBatchHistory.
//
// Lists every Csa.Netting.NettedBatch contract for the given CSA in
// reverse chronological order. Each row shows per-currency net amounts
// (green for receive, red for pay) and the count of effects rolled
// into that batch. Empty state during Stage B (scheduler not yet
// running) renders "No netted settlements yet."
export function NettedBatchHistory({ csaCid }: Props) {
  const { client } = useLedgerClient()

  const {
    data: batches = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['netted-batches', csaCid, client?.authToken],
    queryFn: async () => {
      if (!client) return []
      const rows = await client.query<ContractResult<NettedBatchPayload>>(NETTED_BATCH_TEMPLATE_ID)
      return rows
        .filter((r) => r.payload.csaCid === csaCid)
        .sort((a, b) => (a.payload.paymentTimestamp < b.payload.paymentTimestamp ? 1 : -1))
    },
    enabled: !!client,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <NettedBatchSkeletonRow key={i} />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <div className="text-rose-400 text-sm">
        Error: {error instanceof Error ? error.message : String(error)}
      </div>
    )
  }
  if (batches.length === 0) {
    return (
      <div className="text-sm">
        <div className="text-zinc-500">No net flows have settled yet for this pair.</div>
        <div className="text-[10px] text-zinc-600 mt-0.5">
          The scheduler batches matched flows automatically — entries land here once any do.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {batches.map((b) => (
        <NettedBatchRow key={b.contractId} payload={b.payload} />
      ))}
    </div>
  )
}

function NettedBatchSkeletonRow() {
  return (
    <div
      data-slot="netted-batch-skeleton-row"
      className="border border-zinc-800 rounded p-2 bg-zinc-950"
    >
      <Skeleton className="h-3 w-32" />
      <div className="mt-1 flex flex-wrap gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}

function NettedBatchRow({ payload }: { payload: NettedBatchPayload }) {
  return (
    <div className="border border-zinc-800 rounded p-2 bg-zinc-950">
      <div className="text-xs text-zinc-400">{payload.paymentTimestamp}</div>
      <div className="font-mono text-sm flex flex-wrap gap-3 mt-1">
        {payload.netByCcy.map(([ccy, amt]) => {
          const v = parseFloat(amt)
          const cls = v >= 0 ? 'text-green-400' : 'text-rose-400'
          const sign = v >= 0 ? '+' : ''
          return (
            <span key={ccy} className={cls}>
              {sign}
              {v.toLocaleString()} {ccy}
            </span>
          )
        })}
      </div>
      <div className="text-xs text-zinc-500 mt-1">{payload.settledEffects.length} effects</div>
    </div>
  )
}
