import type { EligibleCollateralPayload, GoverningLaw } from '@/shared/ledger/csa-types'

export interface FormState {
  counterpartyHint: string
  thresholdDirA: string
  thresholdDirB: string
  mta: string
  rounding: string
  valuationCcy: string
  eligible: EligibleCollateralPayload[]
  isdaMasterAgreementRef: string
  governingLaw: GoverningLaw
  imAmount: string
}

export interface TouchedState {
  counterpartyHint: boolean
  mta: boolean
  rounding: boolean
  thresholdDirA: boolean
  thresholdDirB: boolean
  valuationCcy: boolean
  isdaMasterAgreementRef: boolean
  imAmount: boolean
}

export interface EligibleErrors {
  currency?: string
  haircut?: string
}

export const INITIAL_FORM: FormState = {
  counterpartyHint: '',
  thresholdDirA: '0',
  thresholdDirB: '0',
  mta: '0',
  rounding: '0',
  valuationCcy: '',
  eligible: [{ currency: '', haircut: '0' }],
  isdaMasterAgreementRef: '',
  governingLaw: 'NewYork',
  imAmount: '0',
}

export const INITIAL_TOUCHED: TouchedState = {
  counterpartyHint: false,
  mta: false,
  rounding: false,
  thresholdDirA: false,
  thresholdDirB: false,
  valuationCcy: false,
  isdaMasterAgreementRef: false,
  imAmount: false,
}
