import {
  getInstrumentCurrency,
  getInstrumentDirection,
  getInstrumentLegDetail,
  getInstrumentMaturity,
  getInstrumentTradeDate,
} from '@/shared/ledger/instrument-helpers'
import { partyMatchesHint } from '@/shared/ledger/party-match'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import type { ContractResult, MaturedSwap, TerminatedSwap } from '@/shared/ledger/types'
import type { SwapRow, SwapType } from './types'

export {
  getInstrumentCurrency,
  getInstrumentDirection,
  getInstrumentMaturity,
} from '@/shared/ledger/instrument-helpers'

function isPartyAMatch(partyA: string, activeParty: string): boolean {
  return partyMatchesHint(partyA, activeParty)
}

export function maturedToRow(
  c: ContractResult<MaturedSwap>,
  activeParty: string,
  instr: SwapInstrumentPayload | undefined,
): SwapRow {
  const p = c.payload
  const isPartyA = isPartyAMatch(p.partyA, activeParty)
  return {
    contractId: c.contractId,
    type: p.swapType as SwapType,
    counterparty: isPartyA ? p.partyB : p.partyA,
    notional: parseFloat(p.notional),
    currency: getInstrumentCurrency(instr),
    tradeDate: getInstrumentTradeDate(instr),
    maturity: getInstrumentMaturity(instr),
    npv: null,
    dv01: null,
    status: 'Matured',
    direction: getInstrumentDirection(instr, isPartyA),
    legDetail: getInstrumentLegDetail(instr),
    terminalDate: p.actualMaturityDate,
    terminalAmount: parseFloat(p.finalNetAmount),
    settleBatchCid: p.finalSettleBatchCid,
  }
}

export function terminatedToRow(
  c: ContractResult<TerminatedSwap>,
  activeParty: string,
  instr: SwapInstrumentPayload | undefined,
): SwapRow {
  const p = c.payload
  const isPartyA = isPartyAMatch(p.partyA, activeParty)
  return {
    contractId: c.contractId,
    type: p.swapType as SwapType,
    counterparty: isPartyA ? p.partyB : p.partyA,
    notional: parseFloat(p.notional),
    currency: getInstrumentCurrency(instr),
    tradeDate: getInstrumentTradeDate(instr),
    maturity: getInstrumentMaturity(instr),
    npv: null,
    dv01: null,
    status: 'Unwound',
    direction: getInstrumentDirection(instr, isPartyA),
    legDetail: getInstrumentLegDetail(instr),
    terminalDate: p.terminationDate,
    terminalAmount: parseFloat(p.agreedPvAmount),
    reason: p.reason,
    terminatedByParty: p.terminatedByParty,
    settleBatchCid: p.settleBatchCid,
  }
}
