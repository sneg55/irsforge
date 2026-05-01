import type { LegConfig } from '../types'

export const PROPOSAL_TEMPLATES: Record<string, string> = {
  IRS: 'Swap.Proposal:SwapProposal',
  OIS: 'Swap.OisProposal:OisProposal',
  BASIS: 'Swap.BasisSwapProposal:BasisSwapProposal',
  XCCY: 'Swap.XccyFixedFloatProposal:XccyFixedFloatProposal',
  CDS: 'Swap.CdsProposal:CdsProposal',
  CCY: 'Swap.CcySwapProposal:CcySwapProposal',
  FX: 'Swap.FxSwapProposal:FxSwapProposal',
  ASSET: 'Swap.AssetSwapProposal:AssetSwapProposal',
  FpML: 'Swap.FpmlProposal:FpmlProposal',
}

const DAY_COUNT_MAP: Record<string, string> = {
  ACT_360: 'Act360',
  ACT_365: 'Act365Fixed',
  THIRTY_360: 'Basis30360',
  THIRTY_E_360: 'Basis30360',
}

export function getDayCount(leg: LegConfig): string {
  return 'dayCount' in leg ? (DAY_COUNT_MAP[String(leg.dayCount)] ?? 'Act360') : 'Act360'
}

export function getNotional(leg: LegConfig): number {
  return 'notional' in leg ? leg.notional : 0
}

export interface ProposalContext {
  proposer: string
  counterparty: string
  operator: string
  startDate: string
  maturityDate: string
  /**
   * Allowed currency codes from /api/config — used to validate CCY/FX
   * currency fields so proposers can't submit pairs the operator hasn't
   * seeded instrument factories for. `undefined` means "skip validation"
   * (legacy/demo callers without config injection).
   */
  allowedCurrencies?: string[]
}

export interface BuildProposalSuccess {
  ok: true
  payload: Record<string, unknown>
}

export interface BuildProposalError {
  ok: false
  field: string
  message: string
}

export type BuildProposalResult = BuildProposalSuccess | BuildProposalError

export function validateCurrency(
  code: string,
  field: string,
  allowed: string[] | undefined,
): BuildProposalError | null {
  if (!allowed) return null
  if (!allowed.includes(code)) {
    return {
      ok: false,
      field,
      message: `Currency "${code}" is not configured. Allowed: ${allowed.join(', ')}.`,
    }
  }
  return null
}
