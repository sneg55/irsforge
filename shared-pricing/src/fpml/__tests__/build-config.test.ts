import { describe, expect, test } from 'vitest'
import {
  buildBasisSwapConfig,
  buildIrsLikeSwapConfig,
  buildXccySwapConfig,
  mapDayCount,
  parsedFpmlToSwapConfig,
} from '../build-config.js'
import type { ParsedFpml, ParsedLeg } from '../types.js'

const eff = new Date('2026-04-16')
const term = new Date('2027-04-16')

const fixedUsd: ParsedLeg = {
  currency: 'USD',
  notional: 10_000_000,
  rateType: 'fixed',
  fixedRate: 0.045,
  dayCountFraction: 'Act360',
}
const floatUsdSofr: ParsedLeg = {
  currency: 'USD',
  notional: 10_000_000,
  rateType: 'float',
  indexId: 'USD-SOFR',
  spread: 0,
  dayCountFraction: 'Act360',
}
const floatUsdEffr: ParsedLeg = {
  currency: 'USD',
  notional: 25_000_000,
  rateType: 'float',
  indexId: 'USD-EFFR',
  spread: 0,
  dayCountFraction: 'Act360',
}
const floatEurEstr: ParsedLeg = {
  currency: 'EUR',
  notional: 9_000_000,
  rateType: 'float',
  indexId: 'EUR-ESTR',
  spread: 0,
  dayCountFraction: 'Act360',
}

describe('mapDayCount', () => {
  test('maps known Daml conventions', () => {
    expect(mapDayCount('Act360')).toBe('ACT_360')
    expect(mapDayCount('ActActISDA')).toBe('ACT_365')
    expect(mapDayCount('Basis30360')).toBe('THIRTY_360')
  })

  test('passes through already-normalized values', () => {
    expect(mapDayCount('ACT_360')).toBe('ACT_360')
    expect(mapDayCount('ACT_365')).toBe('ACT_365')
  })

  test('throws on unknown conventions', () => {
    expect(() => mapDayCount('Unknown1')).toThrow(/unsupported dayCount/)
  })
})

describe('build*SwapConfig', () => {
  const parsed: ParsedFpml = {
    legs: [fixedUsd, floatUsdSofr],
    effectiveDate: eff,
    terminationDate: term,
  }

  test('buildIrsLikeSwapConfig produces [fixed, float] with opposite notional signs', () => {
    const cfg = buildIrsLikeSwapConfig(fixedUsd, floatUsdSofr, parsed)
    expect(cfg.type).toBe('IRS')
    expect(cfg.legs).toHaveLength(2)
    expect(cfg.legs[0]).toMatchObject({ legType: 'fixed', rate: 0.045, notional: 10_000_000 })
    expect(cfg.legs[1]).toMatchObject({
      legType: 'float',
      indexId: 'USD-SOFR',
      notional: -10_000_000,
    })
    expect(cfg.effectiveDate).toEqual(eff)
    expect(cfg.maturityDate).toEqual(term)
  })

  test('buildBasisSwapConfig produces two float legs on the same currency', () => {
    const cfg = buildBasisSwapConfig(floatUsdSofr, floatUsdEffr, {
      ...parsed,
      legs: [floatUsdSofr, floatUsdEffr],
    })
    expect(cfg.type).toBe('BASIS')
    expect(cfg.legs).toHaveLength(2)
    expect((cfg.legs[0] as { indexId: string }).indexId).toBe('USD-SOFR')
    expect((cfg.legs[1] as { indexId: string; notional: number }).indexId).toBe('USD-EFFR')
    expect((cfg.legs[1] as { notional: number }).notional).toBe(-25_000_000)
  })

  test('buildXccySwapConfig produces fixed + float on different currencies', () => {
    const cfg = buildXccySwapConfig(fixedUsd, floatEurEstr, {
      ...parsed,
      legs: [fixedUsd, floatEurEstr],
    })
    expect(cfg.type).toBe('XCCY')
    expect((cfg.legs[0] as { currency: string }).currency).toBe('USD')
    expect((cfg.legs[1] as { currency: string }).currency).toBe('EUR')
  })
})

describe('parsedFpmlToSwapConfig (dispatch)', () => {
  test('classifies IRS (fixed + float, one ccy) → buildIrsLikeSwapConfig', () => {
    const cfg = parsedFpmlToSwapConfig({
      legs: [fixedUsd, floatUsdSofr],
      effectiveDate: eff,
      terminationDate: term,
    })
    expect(cfg.type).toBe('IRS')
  })

  test('classifies BASIS (two floats, same ccy)', () => {
    const cfg = parsedFpmlToSwapConfig({
      legs: [floatUsdSofr, floatUsdEffr],
      effectiveDate: eff,
      terminationDate: term,
    })
    expect(cfg.type).toBe('BASIS')
  })

  test('classifies XCCY (fixed + float, different ccys)', () => {
    const cfg = parsedFpmlToSwapConfig({
      legs: [fixedUsd, floatEurEstr],
      effectiveDate: eff,
      terminationDate: term,
    })
    expect(cfg.type).toBe('XCCY')
  })

  test('throws on unclassifiable streams', () => {
    const mystery: ParsedLeg = { ...fixedUsd, rateType: 'fixed', fixedRate: undefined }
    expect(() =>
      parsedFpmlToSwapConfig({
        legs: [mystery],
        effectiveDate: eff,
        terminationDate: term,
      }),
    ).toThrow()
  })
})
