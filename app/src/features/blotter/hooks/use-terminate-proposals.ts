import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { pollIntervalWithBackoff } from '@/shared/ledger/poll-interval'
import type { ContractResult } from '@/shared/ledger/types'

export interface TerminateProposalEntry {
  proposalCid: string
  proposer: string
  counterparty: string
  proposedPvAmount: number
}

interface TerminateProposalPayload {
  proposer: string
  counterparty: string
  workflowCid: string
  proposedPvAmount: string
  reason: string
  proposedAt: string
}

/**
 * Query all outstanding `Swap.Terminate:TerminateProposal` contracts and
 * index them by `workflowCid` so active rows can flag pending unwinds.
 * Refetch cadence matches the other blotter queries (3s).
 */
export function useTerminateProposals(): Map<string, TerminateProposalEntry> {
  const { client } = useLedgerClient()

  const { data } = useQuery<ContractResult<TerminateProposalPayload>[]>({
    queryKey: ['terminate-proposals'],
    queryFn: async () => {
      if (!client) return []
      return await client.query<ContractResult<TerminateProposalPayload>>(
        'Swap.Terminate:TerminateProposal',
      )
    },
    enabled: !!client,
    refetchInterval: pollIntervalWithBackoff(3_000),
  })

  return useMemo(() => {
    const map = new Map<string, TerminateProposalEntry>()
    for (const c of data ?? []) {
      map.set(c.payload.workflowCid, {
        proposalCid: c.contractId,
        proposer: c.payload.proposer,
        counterparty: c.payload.counterparty,
        proposedPvAmount: parseFloat(c.payload.proposedPvAmount),
      })
    }
    return map
  }, [data])
}
