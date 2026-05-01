'use client'

import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { PROPOSAL_TEMPLATES } from '@/features/workspace/hooks/build-proposal-payload'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import type { ContractResult } from '@/shared/ledger/types'

export type SwapFamily = 'IRS' | 'OIS' | 'BASIS' | 'XCCY' | 'CDS' | 'CCY' | 'FX' | 'ASSET' | 'FpML'

// Single source of truth for the family→template mapping is the workspace
// builder; reuse it so a new family lands in the regulator query
// automatically. v1 had a parallel list that omitted XCCY — exactly the
// drift this avoids.
const TEMPLATES: { family: SwapFamily; templateId: string }[] = (
  Object.entries(PROPOSAL_TEMPLATES) as [SwapFamily, string][]
).map(([family, templateId]) => ({ family, templateId }))

export interface CrossOrgProposalRow {
  family: SwapFamily
  contractId: string
  proposer: string
  counterparty: string
  payload: unknown
}

export interface UseAllProposalsCrossOrgResult {
  proposals: CrossOrgProposalRow[]
  isLoading: boolean
}

export function useAllProposalsCrossOrg(): UseAllProposalsCrossOrgResult {
  const { client, activeParty } = useLedgerClient()

  const results = useQueries({
    queries: TEMPLATES.map(({ family, templateId }) => ({
      queryKey: ['regulator', 'proposal', family, activeParty],
      queryFn: async () => {
        if (!client) return [] as ContractResult<unknown>[]
        return await client.query<ContractResult<unknown>>(templateId)
      },
      enabled: !!client,
      refetchInterval: 3_000,
    })),
  })

  const isLoading = results.some((r) => r.isLoading)
  const proposals = useMemo<CrossOrgProposalRow[]>(() => {
    const out: CrossOrgProposalRow[] = []
    results.forEach((r, i) => {
      const family = TEMPLATES[i].family
      const rows = r.data ?? []
      for (const c of rows) {
        const p = c.payload as { proposer?: string; counterparty?: string }
        out.push({
          family,
          contractId: c.contractId,
          proposer: p.proposer ?? '',
          counterparty: p.counterparty ?? '',
          payload: c.payload,
        })
      }
    })
    return out
  }, [results])

  return { proposals, isLoading }
}
