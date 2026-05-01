import type { SwapType } from '@irsforge/shared-pricing'
import {
  getInstrumentLegDetail,
  getInstrumentTradeDate,
  isMaturingWithin,
} from '@/shared/ledger/instrument-helpers'
import { partyMatchesHint } from '@/shared/ledger/party-match'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import type { ContractResult, SwapWorkflow } from '@/shared/ledger/types'
import type { TerminateProposalEntry } from './hooks/use-terminate-proposals'
import { getInstrumentCurrency, getInstrumentDirection, getInstrumentMaturity } from './mappers'
import type { SwapRow } from './types'

export function workflowToRow(
  c: ContractResult<SwapWorkflow>,
  activeParty: string,
  valuation: { npv: number; dv01: number; sparkline: number[] } | undefined,
  instr: SwapInstrumentPayload | undefined,
  proposals: Map<string, TerminateProposalEntry>,
): SwapRow {
  const w = c.payload
  const isPartyA = partyMatchesHint(w.partyA, activeParty)

  const proposal = proposals.get(c.contractId)
  let status: SwapRow['status'] = 'Active'
  let pendingUnwind: SwapRow['pendingUnwind']
  if (proposal) {
    const role: 'proposer' | 'counterparty' = partyMatchesHint(proposal.proposer, activeParty)
      ? 'proposer'
      : 'counterparty'
    status = 'UnwindPending'
    pendingUnwind = { role, proposalCid: proposal.proposalCid }
  }

  return {
    contractId: c.contractId,
    type: w.swapType as SwapType,
    counterparty: isPartyA ? w.partyB : w.partyA,
    notional: parseFloat(w.notional),
    currency: getInstrumentCurrency(instr),
    tradeDate: getInstrumentTradeDate(instr),
    maturity: getInstrumentMaturity(instr),
    npv: valuation?.npv ?? null,
    dv01: valuation?.dv01 ?? null,
    sparkline: valuation?.sparkline,
    status,
    direction: getInstrumentDirection(instr, isPartyA),
    legDetail: getInstrumentLegDetail(instr),
    maturingSoon: isMaturingWithin(instr),
    pendingUnwind,
  }
}
