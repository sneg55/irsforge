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

  const direction = getInstrumentDirection(instr, isPartyA)
  // Pricing engine in @irsforge/shared-pricing anchors to the "receive"
  // perspective: `directionSign(leg) === 1` for 'receive' and `-1` for
  // 'pay'. The leg directions used to build SwapConfig in
  // use-blotter-valuation.ts (and for FpML, in the shared decoder) are
  // therefore anchored to ONE party — typically PartyB / receive-fixed.
  // That made both counterparties read the same signed NPV (audit E1).
  // Flip the engine output for any viewer whose own row direction is
  // 'pay', so each side reads a viewer-relative MTM. DV01 and the
  // sparkline carry the same anchor and flip with the same rule.
  // Skip the flip when `instr` is undefined: the direction is a default
  // ('pay') in that case and flipping would invert a value whose own
  // perspective we cannot determine.
  const viewerSign = instr && direction === 'pay' ? -1 : 1
  const npv = valuation?.npv == null ? null : valuation.npv * viewerSign
  const dv01 = valuation?.dv01 == null ? null : valuation.dv01 * viewerSign
  const sparkline = valuation?.sparkline?.map((v) => v * viewerSign)
  return {
    contractId: c.contractId,
    type: w.swapType as SwapType,
    partyA: w.partyA,
    partyB: w.partyB,
    counterparty: isPartyA ? w.partyB : w.partyA,
    notional: parseFloat(w.notional),
    currency: getInstrumentCurrency(instr),
    tradeDate: getInstrumentTradeDate(instr),
    maturity: getInstrumentMaturity(instr),
    npv,
    dv01,
    sparkline,
    status,
    direction,
    legDetail: getInstrumentLegDetail(instr),
    maturingSoon: isMaturingWithin(instr),
    pendingUnwind,
  }
}
