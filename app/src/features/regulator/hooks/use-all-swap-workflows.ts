'use client'

import { useQuery } from '@tanstack/react-query'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { pollIntervalWithBackoff } from '@/shared/ledger/poll-interval'
import type {
  ContractResult,
  MaturedSwap,
  SwapWorkflow,
  TerminatedSwap,
} from '@/shared/ledger/types'

const REFETCH_MS = 3_000

export interface UseAllSwapWorkflowsResult {
  workflows: ContractResult<SwapWorkflow>[]
  matured: ContractResult<MaturedSwap>[]
  terminated: ContractResult<TerminatedSwap>[]
  isLoading: boolean
}

/**
 * Cross-org workflow query for the regulator surface. Same template IDs as
 * the trader blotter; differs only in JWT scope — the regulator's actAs
 * returns every workflow because Regulator is observer on every
 * Swap.Workflow:SwapWorkflow contract.
 */
export function useAllSwapWorkflows(): UseAllSwapWorkflowsResult {
  const { client, activeParty } = useLedgerClient()

  const wfQ = useQuery<ContractResult<SwapWorkflow>[]>({
    queryKey: ['regulator', 'workflows', activeParty],
    queryFn: async () => {
      if (!client) return []
      return await client.query<ContractResult<SwapWorkflow>>('Swap.Workflow:SwapWorkflow')
    },
    enabled: !!client,
    refetchInterval: pollIntervalWithBackoff(REFETCH_MS),
  })

  const matQ = useQuery<ContractResult<MaturedSwap>[]>({
    queryKey: ['regulator', 'matured', activeParty],
    queryFn: async () => {
      if (!client) return []
      return await client.query<ContractResult<MaturedSwap>>('Swap.Workflow:MaturedSwap')
    },
    enabled: !!client,
    refetchInterval: pollIntervalWithBackoff(REFETCH_MS),
  })

  const termQ = useQuery<ContractResult<TerminatedSwap>[]>({
    queryKey: ['regulator', 'terminated', activeParty],
    queryFn: async () => {
      if (!client) return []
      return await client.query<ContractResult<TerminatedSwap>>('Swap.Terminate:TerminatedSwap')
    },
    enabled: !!client,
    refetchInterval: pollIntervalWithBackoff(REFETCH_MS),
  })

  return {
    workflows: wfQ.data ?? [],
    matured: matQ.data ?? [],
    terminated: termQ.data ?? [],
    isLoading: wfQ.isLoading || matQ.isLoading || termQ.isLoading,
  }
}
