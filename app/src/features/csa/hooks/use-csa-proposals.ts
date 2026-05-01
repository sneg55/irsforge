'use client'

import { useQuery } from '@tanstack/react-query'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import type { EligibleCollateralPayload } from '@/shared/ledger/csa-types'
import { CSA_PROPOSAL_TEMPLATE_ID } from '@/shared/ledger/template-ids'

export interface CsaProposalPayload {
  operator: string
  regulators: string[]
  proposer: string
  counterparty: string
  thresholdDirA: string
  thresholdDirB: string
  mta: string
  rounding: string
  eligible: EligibleCollateralPayload[]
  valuationCcy: string
}

export interface CsaProposalRow {
  contractId: string
  proposerHint: string
  counterpartyHint: string
  thresholdDirA: number
  thresholdDirB: number
  mta: number
  rounding: number
  eligible: EligibleCollateralPayload[]
  valuationCcy: string
  directionForMe: 'in' | 'out' | 'observer'
}

function hintFromParty(fullParty: string): string {
  return fullParty.split('::')[0] ?? fullParty
}

export const CSA_PROPOSALS_QUERY_KEY = 'csa-proposals'

export interface UseCsaProposalsResult {
  proposals: CsaProposalRow[]
  isLoading: boolean
  isPending: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => void
}

export function useCsaProposals(): UseCsaProposalsResult {
  const { client, activeParty } = useLedgerClient()

  const query = useQuery<CsaProposalRow[]>({
    queryKey: [CSA_PROPOSALS_QUERY_KEY, activeParty],
    queryFn: async () => {
      if (!client) return []
      const raw = await client.query<{ contractId: string; payload: CsaProposalPayload }>(
        CSA_PROPOSAL_TEMPLATE_ID,
      )
      return raw.map((r) => {
        const { payload } = r
        const proposerHint = hintFromParty(payload.proposer)
        const counterpartyHint = hintFromParty(payload.counterparty)

        let directionForMe: 'in' | 'out' | 'observer' = 'observer'
        if (activeParty && proposerHint === activeParty) {
          directionForMe = 'out'
        } else if (activeParty && counterpartyHint === activeParty) {
          directionForMe = 'in'
        }

        return {
          contractId: r.contractId,
          proposerHint,
          counterpartyHint,
          thresholdDirA: parseFloat(payload.thresholdDirA),
          thresholdDirB: parseFloat(payload.thresholdDirB),
          mta: parseFloat(payload.mta),
          rounding: parseFloat(payload.rounding),
          eligible: payload.eligible,
          valuationCcy: payload.valuationCcy,
          directionForMe,
        }
      })
    },
    enabled: !!client,
    refetchInterval: 5_000,
  })

  return {
    proposals: query.data ?? [],
    isLoading: query.isLoading,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch()
    },
  }
}
