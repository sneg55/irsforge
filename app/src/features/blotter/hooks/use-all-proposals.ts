'use client'

import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { pollIntervalWithBackoff } from '@/shared/ledger/poll-interval'
import type { ContractResult } from '@/shared/ledger/types'
import type { SwapRow, SwapType } from '../types'
import {
  type AnyProposal,
  getCounterparty,
  getCurrency,
  getDirection,
  getMaturity,
  getNotional,
  getProposalTradeDate,
} from './proposal-helpers'

const TEMPLATES: { type: SwapType; templateId: string }[] = [
  { type: 'IRS', templateId: 'Swap.Proposal:SwapProposal' },
  { type: 'OIS', templateId: 'Swap.OisProposal:OisProposal' },
  { type: 'BASIS', templateId: 'Swap.BasisSwapProposal:BasisSwapProposal' },
  { type: 'CDS', templateId: 'Swap.CdsProposal:CdsProposal' },
  { type: 'CCY', templateId: 'Swap.CcySwapProposal:CcySwapProposal' },
  { type: 'FX', templateId: 'Swap.FxSwapProposal:FxSwapProposal' },
  { type: 'ASSET', templateId: 'Swap.AssetSwapProposal:AssetSwapProposal' },
  { type: 'FpML', templateId: 'Swap.FpmlProposal:FpmlProposal' },
]

function toRow(type: SwapType, c: ContractResult<AnyProposal>, activeParty: string): SwapRow {
  return {
    contractId: c.contractId,
    type,
    counterparty: getCounterparty(c.payload, activeParty),
    notional: getNotional(type, c.payload),
    currency: getCurrency(type, c.payload),
    tradeDate: getProposalTradeDate(type, c.payload),
    maturity: getMaturity(type, c.payload),
    npv: null,
    dv01: null,
    status: 'Proposed',
    direction: getDirection(type, c.payload, activeParty),
  }
}

export function useAllProposals() {
  const { client, activeParty } = useLedgerClient()
  // activeParty from AuthState is already the party hint (PartyA/PartyB) used for on-chain matching
  const partyHint = activeParty ?? ''

  const results = useQueries({
    queries: TEMPLATES.map(({ type, templateId }) => ({
      queryKey: ['proposals', type, activeParty],
      queryFn: async () => {
        if (!client) return []
        return await client.query<ContractResult<AnyProposal>>(templateId)
      },
      enabled: !!client,
      refetchInterval: pollIntervalWithBackoff(3_000),
    })),
  })

  // React Query structural-shares data on each refetch, so per-family data
  // refs are stable when contents haven't changed. Depending on those refs
  // (via dataUpdatedAt) avoids rebuilding rows on every parent re-render.
  const resultsKey = results.map((q) => q.dataUpdatedAt).join(',')
  const proposalRows = useMemo<SwapRow[]>(() => {
    const rows: SwapRow[] = []
    for (let i = 0; i < TEMPLATES.length; i++) {
      const data = results[i].data ?? []
      for (const c of data) {
        rows.push(toRow(TEMPLATES[i].type, c, partyHint))
      }
    }
    return rows
  }, [resultsKey, partyHint])

  const isLoading = results.some((q) => q.isLoading)
  return { proposalRows, isLoading }
}
