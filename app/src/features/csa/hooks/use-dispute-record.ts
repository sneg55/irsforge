'use client'

import { useQuery } from '@tanstack/react-query'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { CSA_DISPUTE_RECORD_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { ContractResult, DisputeRecordPayload } from '@/shared/ledger/types'

export interface DisputeRecordViewModel {
  contractId: string
  csaCid: string
  disputer: string
  counterMark: number
  reason: DisputeRecordPayload['reason']
  notes: string
  openedAt: string
}

const REFETCH_MS = 5_000

/**
 * Resolve the active `Csa.Dispute:DisputeRecord` by contract id.
 *
 * The Csa carries `activeDispute: string | null` — we query the whole
 * DisputeRecord ACS (small set, one per disputed CSA) and find the
 * matching cid in memory rather than hitting `/v1/fetch` (which our
 * `LedgerClient` doesn't expose). Returns `null` while loading or when
 * the cid is not found (e.g. just-archived after AgreeToCounterMark).
 */
export function useDisputeRecord(disputeCid: string | null): {
  data: DisputeRecordViewModel | null
  isLoading: boolean
} {
  const { client, activeParty } = useLedgerClient()
  const query = useQuery<DisputeRecordViewModel | null>({
    queryKey: ['dispute-record', activeParty, disputeCid],
    queryFn: async () => {
      if (!client || !disputeCid) return null
      const raw = await client.query<ContractResult<DisputeRecordPayload>>(
        CSA_DISPUTE_RECORD_TEMPLATE_ID,
      )
      const found = raw.find((r) => r.contractId === disputeCid)
      if (!found) return null
      return {
        contractId: found.contractId,
        csaCid: found.payload.csaCid,
        disputer: found.payload.disputer,
        counterMark: parseFloat(found.payload.counterMark),
        reason: found.payload.reason,
        notes: found.payload.notes,
        openedAt: found.payload.openedAt,
      }
    },
    enabled: !!client && !!disputeCid,
    refetchInterval: REFETCH_MS,
  })
  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
  }
}
