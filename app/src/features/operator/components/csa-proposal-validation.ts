import type { EligibleCollateralPayload } from '@/shared/ledger/csa-types'
import type { EligibleErrors, FormState } from './csa-proposal-form-types'

export interface FieldError {
  field: string
  msg: string
}

export function validateForm(form: FormState, activeParty: string | null): FieldError[] {
  const errors: FieldError[] = []

  if (!form.counterpartyHint.trim()) {
    errors.push({ field: 'counterpartyHint', msg: 'Required' })
  } else if (form.counterpartyHint.trim() === activeParty) {
    errors.push({ field: 'counterpartyHint', msg: 'Cannot be the same as your party' })
  }

  if (parseFloat(form.thresholdDirA) < 0 || isNaN(parseFloat(form.thresholdDirA))) {
    errors.push({ field: 'thresholdDirA', msg: 'Must be ≥ 0' })
  }
  if (parseFloat(form.thresholdDirB) < 0 || isNaN(parseFloat(form.thresholdDirB))) {
    errors.push({ field: 'thresholdDirB', msg: 'Must be ≥ 0' })
  }
  if (parseFloat(form.mta) < 0 || isNaN(parseFloat(form.mta))) {
    errors.push({ field: 'mta', msg: 'Must be ≥ 0' })
  }
  if (parseFloat(form.rounding) < 0 || isNaN(parseFloat(form.rounding))) {
    errors.push({ field: 'rounding', msg: 'Must be ≥ 0' })
  }
  if (!form.valuationCcy.trim()) {
    errors.push({ field: 'valuationCcy', msg: 'Required' })
  }
  if (!form.isdaMasterAgreementRef.trim()) {
    errors.push({
      field: 'isdaMasterAgreementRef',
      msg: 'ISDA Master Agreement reference required',
    })
  }
  const im = parseFloat(form.imAmount)
  if (Number.isNaN(im) || im < 0) {
    errors.push({ field: 'imAmount', msg: 'Initial margin must be ≥ 0' })
  }
  if (form.eligible.length === 0) {
    errors.push({ field: 'eligible', msg: 'At least one row required' })
  }
  for (const row of form.eligible) {
    if (!row.currency) {
      errors.push({ field: 'eligible', msg: 'Currency required' })
    }
    const h = parseFloat(row.haircut)
    if (isNaN(h) || h < 0 || h > 1) {
      errors.push({ field: 'eligible', msg: 'Haircut must be in [0, 1]' })
    }
  }
  return errors
}

export function eligibleRowErrors(row: EligibleCollateralPayload): EligibleErrors {
  const out: EligibleErrors = {}
  if (!row.currency) out.currency = 'Required'
  const h = parseFloat(row.haircut)
  if (isNaN(h) || h < 0 || h > 1) out.haircut = '[0, 1]'
  return out
}
