import { partyMatchesHint } from '@/shared/ledger/party-match'
import type {
  AssetSwapProposal,
  BasisSwapProposal,
  CcySwapProposal,
  CdsProposal,
  FpmlProposal,
  FxSwapProposal,
  OisProposal,
  SwapProposal,
} from '@/shared/ledger/types'
import type { SwapType } from '../types'

export type AnyProposal =
  | SwapProposal
  | OisProposal
  | BasisSwapProposal
  | CdsProposal
  | CcySwapProposal
  | FxSwapProposal
  | AssetSwapProposal
  | FpmlProposal

export function getNotional(type: SwapType, payload: AnyProposal): number {
  if (type === 'FpML') {
    const fpml = payload as FpmlProposal
    return parseFloat(fpml.legs[0]?.notional ?? '0')
  }
  return parseFloat((payload as Exclude<AnyProposal, FpmlProposal>).notional)
}

export function getCounterparty(payload: AnyProposal, activeParty: string): string {
  const isProposer = partyMatchesHint(payload.proposer, activeParty)
  return isProposer ? payload.counterparty : payload.proposer
}

export function getDirection(
  type: SwapType,
  payload: AnyProposal,
  activeParty: string,
): 'pay' | 'receive' {
  const isProposer = partyMatchesHint(payload.proposer, activeParty)
  switch (type) {
    case 'IRS':
      return isProposer ? 'pay' : 'receive'
    case 'OIS':
      return isProposer ? 'pay' : 'receive'
    case 'BASIS':
      return isProposer ? 'pay' : 'receive'
    case 'XCCY':
      return isProposer ? 'pay' : 'receive'
    case 'CDS':
      return (payload as CdsProposal).ownerReceivesFix === isProposer ? 'receive' : 'pay'
    case 'CCY':
      return (payload as CcySwapProposal).ownerReceivesBase === isProposer ? 'receive' : 'pay'
    case 'FX':
      return isProposer ? 'pay' : 'receive'
    case 'ASSET':
      return (payload as AssetSwapProposal).ownerReceivesRate === isProposer ? 'receive' : 'pay'
    case 'FpML':
      return isProposer ? 'pay' : 'receive'
  }
}

export function getCurrency(type: SwapType, payload: AnyProposal): string {
  switch (type) {
    case 'CCY':
    case 'XCCY':
      return (payload as CcySwapProposal).baseCurrency
    case 'FX':
      return (payload as FxSwapProposal).baseCurrency
    case 'FpML':
      return (payload as FpmlProposal).legs[0]?.currency ?? 'USD'
    case 'BASIS':
      return (payload as BasisSwapProposal).currency
    case 'IRS':
    case 'OIS':
    case 'CDS':
    case 'ASSET':
      // These instruments are USD-denominated in the configured demo setup;
      // the on-chain payload carries no explicit currency field.
      return 'USD'
  }
}

// Tenor-to-days mapping mirrors the Daml `tenorToDays` in Swap/Types.daml
// (D90 = 91 not 90 is intentional; it matches the on-chain cashflow schedule).
const IRS_TENOR_DAYS: Record<string, number> = {
  D30: 30,
  D90: 91,
  D180: 182,
  Y1: 365,
}

function addDaysIso(startDate: string, days: number): string {
  // Parse as UTC midnight so day arithmetic never straddles a timezone edge.
  const d = new Date(`${startDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return '—'
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function getMaturity(type: SwapType, payload: AnyProposal): string {
  if (type === 'IRS') {
    const irs = payload as SwapProposal
    const days = IRS_TENOR_DAYS[irs.tenor]
    if (days == null || !irs.startDate) return '—'
    return addDaysIso(irs.startDate, days)
  }
  if ('maturityDate' in payload && payload.maturityDate) return payload.maturityDate
  return '—'
}

export function getProposalTradeDate(type: SwapType, payload: AnyProposal): string {
  if (type === 'FX') {
    // FX proposals use firstPaymentDate as the closest analogue to a
    // trade/effective date. Falls back to '—' if absent.
    const fx = payload as FxSwapProposal
    return fx.firstPaymentDate ?? '—'
  }
  if ('startDate' in payload && payload.startDate) return payload.startDate
  return '—'
}
