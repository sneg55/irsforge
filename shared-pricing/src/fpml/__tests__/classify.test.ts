import { describe, expect, it } from 'vitest'
import { classify } from '../classify.js'
import type { ParsedFpml, ParsedLeg } from '../types.js'

const fixedUsd: ParsedLeg = {
  currency: 'USD',
  notional: 10_000_000,
  rateType: 'fixed',
  fixedRate: 0.04,
  dayCountFraction: 'ACT/360',
}
const floatUsdLibor: ParsedLeg = {
  currency: 'USD',
  notional: 10_000_000,
  rateType: 'float',
  indexId: 'USD-LIBOR-3M',
  spread: 0,
  dayCountFraction: 'ACT/360',
}
const floatUsdSofr: ParsedLeg = {
  currency: 'USD',
  notional: 10_000_000,
  rateType: 'float',
  indexId: 'USD-SOFR',
  spread: 0,
  compounding: 'CompoundedInArrears',
  dayCountFraction: 'ACT/360',
}
const floatUsdEffr: ParsedLeg = {
  currency: 'USD',
  notional: 10_000_000,
  rateType: 'float',
  indexId: 'USD-EFFR',
  spread: 0.0015,
  compounding: 'OvernightAverage',
  dayCountFraction: 'ACT/360',
}
const floatEurEstr: ParsedLeg = {
  currency: 'EUR',
  notional: 9_000_000,
  rateType: 'float',
  indexId: 'EUR-ESTR',
  spread: 0,
  compounding: 'CompoundedInArrears',
  dayCountFraction: 'ACT/360',
}

const dates = {
  effectiveDate: new Date('2026-01-01'),
  terminationDate: new Date('2031-01-01'),
}

const fpml = (legs: ParsedLeg[]): ParsedFpml => ({ legs, ...dates })

describe('classify', () => {
  it('vanilla IRS (fixed + non-overnight float, same ccy)', () => {
    const cls = classify(fpml([fixedUsd, floatUsdLibor]))
    expect(cls.productType).toBe('IRS')
  })

  it('OIS (fixed + overnight-compounded SOFR float, same ccy)', () => {
    const cls = classify(fpml([fixedUsd, floatUsdSofr]))
    expect(cls.productType).toBe('OIS')
  })

  it('BASIS (two floats, same ccy)', () => {
    const cls = classify(fpml([floatUsdLibor, floatUsdEffr]))
    expect(cls.productType).toBe('BASIS')
  })

  it('XCCY (fixed + float, different ccy)', () => {
    const cls = classify(fpml([fixedUsd, floatEurEstr]))
    expect(cls.productType).toBe('XCCY')
  })

  it('rejects non-2 stream counts', () => {
    const cls = classify(fpml([fixedUsd]))
    expect(cls.productType).toBeNull()
    if (cls.productType === null) {
      expect(cls.reason).toMatch(/stream count/i)
    }
  })

  it('rejects two-fixed (no float)', () => {
    const cls = classify(fpml([fixedUsd, fixedUsd]))
    expect(cls.productType).toBeNull()
  })

  it('IRS classification carries fixed + float legs by name', () => {
    const cls = classify(fpml([fixedUsd, floatUsdLibor]))
    if (cls.productType !== 'IRS') throw new Error('expected IRS')
    expect(cls.fixedLeg.rateType).toBe('fixed')
    expect(cls.floatLeg.rateType).toBe('float')
  })
})
