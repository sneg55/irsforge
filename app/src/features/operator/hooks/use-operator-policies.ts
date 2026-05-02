'use client'

import { useQuery } from '@tanstack/react-query'
import type { OperatorPolicyMode, SwapFamily } from '@/shared/config/client'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { pollIntervalWithBackoff } from '@/shared/ledger/poll-interval'
import { OPERATOR_POLICY_TEMPLATE_ID } from '@/shared/ledger/template-ids'

interface OperatorPolicyDamlPayload {
  operator: string
  regulators: string[]
  traders: string[]
  family: string
  mode: 'Auto' | 'Manual'
}

export interface OperatorPolicyRow {
  contractId: string
  family: SwapFamily
  mode: OperatorPolicyMode
}

const VALID_FAMILIES: ReadonlySet<SwapFamily> = new Set([
  'IRS',
  'OIS',
  'BASIS',
  'XCCY',
  'CDS',
  'CCY',
  'FX',
  'ASSET',
  'FpML',
])

function damlModeToClient(mode: OperatorPolicyDamlPayload['mode']): OperatorPolicyMode {
  return mode === 'Manual' ? 'manual' : 'auto'
}

export const OPERATOR_POLICIES_QUERY_KEY = 'operator-policies'

export interface UseOperatorPoliciesResult {
  rows: OperatorPolicyRow[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => void
}

export function useOperatorPolicies(): UseOperatorPoliciesResult {
  const { client, activeParty } = useLedgerClient()

  const query = useQuery<OperatorPolicyRow[]>({
    queryKey: [OPERATOR_POLICIES_QUERY_KEY, activeParty],
    queryFn: async () => {
      if (!client) return []
      const raw = await client.query<{
        contractId: string
        payload: OperatorPolicyDamlPayload
      }>(OPERATOR_POLICY_TEMPLATE_ID)
      const rows: OperatorPolicyRow[] = []
      for (const r of raw) {
        if (VALID_FAMILIES.has(r.payload.family as SwapFamily)) {
          rows.push({
            contractId: r.contractId,
            family: r.payload.family as SwapFamily,
            mode: damlModeToClient(r.payload.mode),
          })
        }
      }
      return rows
    },
    enabled: !!client,
    refetchInterval: pollIntervalWithBackoff(5_000),
  })

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch()
    },
  }
}
