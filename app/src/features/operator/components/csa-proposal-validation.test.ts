import { describe, expect, it } from 'vitest'
import { INITIAL_FORM } from './csa-proposal-form-types'
import { validateForm } from './csa-proposal-validation'

const validForm = {
  ...INITIAL_FORM,
  counterpartyHint: 'PartyB',
  valuationCcy: 'USD',
  isdaMasterAgreementRef: 'ISDA-2002-DEMO',
  eligible: [{ currency: 'USD', haircut: '0.02' }],
}

describe('validateForm', () => {
  it('rejects empty isdaMasterAgreementRef', () => {
    const errs = validateForm({ ...validForm, isdaMasterAgreementRef: '' }, 'PartyA')
    expect(errs.some((e) => e.field === 'isdaMasterAgreementRef')).toBe(true)
  })

  it('rejects whitespace-only isdaMasterAgreementRef', () => {
    const errs = validateForm({ ...validForm, isdaMasterAgreementRef: '   ' }, 'PartyA')
    expect(errs.some((e) => e.field === 'isdaMasterAgreementRef')).toBe(true)
  })

  it('rejects negative imAmount', () => {
    const errs = validateForm({ ...validForm, imAmount: '-1' }, 'PartyA')
    expect(errs.some((e) => e.field === 'imAmount')).toBe(true)
  })

  it('rejects non-numeric imAmount', () => {
    const errs = validateForm({ ...validForm, imAmount: 'abc' }, 'PartyA')
    expect(errs.some((e) => e.field === 'imAmount')).toBe(true)
  })

  it('accepts zero imAmount', () => {
    const errs = validateForm({ ...validForm, imAmount: '0' }, 'PartyA')
    expect(errs.some((e) => e.field === 'imAmount')).toBe(false)
  })

  it('accepts positive imAmount + populated ref together', () => {
    const errs = validateForm(
      { ...validForm, imAmount: '25000000', isdaMasterAgreementRef: 'X' },
      'PartyA',
    )
    expect(errs.some((e) => e.field === 'imAmount')).toBe(false)
    expect(errs.some((e) => e.field === 'isdaMasterAgreementRef')).toBe(false)
  })
})
