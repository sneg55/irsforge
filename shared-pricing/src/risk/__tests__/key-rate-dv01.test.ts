import { describe, expect, test } from 'vitest'
import { pricingEngine } from '../../engine/price.js'
import type {
  CurveBook,
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  SwapConfig,
} from '../../engine/types.js'
import { keyRateDv01 } from '../metrics.js'

const curve: DiscountCurve = {
  currency: 'USD',
  curveType: 'Discount',
  indexId: null,
  asOf: '2026-04-10T00:00:00Z',
  pillars: [
    { tenorDays: 91, zeroRate: 0.0431 },
    { tenorDays: 365, zeroRate: 0.0415 },
    { tenorDays: 1826, zeroRate: 0.0387 },
  ],
  interpolation: 'LinearZero',
  dayCount: 'Act360',
}

const sofr: FloatingRateIndex = {
  indexId: 'USD-SOFR',
  currency: 'USD',
  family: 'SOFR',
  compounding: 'CompoundedInArrears',
  lookback: 0,
  floor: null,
}

const schedule = {
  startDate: new Date(2026, 3, 15),
  endDate: new Date(2027, 3, 15),
  frequency: 'Quarterly' as const,
}
const fixedLeg: FixedLegConfig = {
  legType: 'fixed',
  currency: 'USD',
  notional: 50e6,
  rate: 0.0425,
  dayCount: 'ACT_360',
  schedule,
}
const floatLeg: FloatLegConfig = {
  legType: 'float',
  currency: 'USD',
  notional: 50e6,
  indexId: 'SOFR',
  spread: 0,
  dayCount: 'ACT_360',
  schedule,
}
const irs: SwapConfig = {
  type: 'IRS',
  legs: [fixedLeg, floatLeg],
  tradeDate: new Date(2026, 3, 10),
  effectiveDate: schedule.startDate,
  maturityDate: schedule.endDate,
}
const ctx: PricingContext = { curve, index: sofr, observations: [] }

describe('keyRateDv01 (single-curve IRS)', () => {
  test('returns one entry per pillar', () => {
    const entries = keyRateDv01(irs, ctx)
    expect(entries).toHaveLength(3)
    expect(entries.map((e) => e.pillarTenorDays).sort((a, b) => a - b)).toEqual([91, 365, 1826])
    entries.forEach((e) => {
      expect(e.currency).toBe('USD')
      expect(e.curveType).toBe('Discount')
    })
  })

  test('sum of KRD entries equals parallel DV01 within 1e-8·|NPV|', () => {
    const { dv01: parallel, npv } = pricingEngine.price(irs, ctx)
    const sumKrd = keyRateDv01(irs, ctx).reduce((s, e) => s + e.dv01, 0)
    expect(Math.abs(Math.abs(sumKrd) - parallel)).toBeLessThan(1e-8 * Math.max(Math.abs(npv), 1))
  })
})

describe('keyRateDv01 (XCCY, multi-curve)', () => {
  const eurCurve: DiscountCurve = { ...curve, currency: 'EUR' }
  const book: CurveBook = {
    asOf: curve.asOf,
    byCurrency: {
      USD: { discount: curve, projections: { 'USD-SOFR': { ...curve, curveType: 'Projection' } } },
      EUR: {
        discount: eurCurve,
        projections: { 'EUR-ESTR': { ...eurCurve, curveType: 'Projection' } },
      },
    },
  }
  const xccyLegUsd: FixedLegConfig = { ...fixedLeg, currency: 'USD' }
  const xccyLegEur: FloatLegConfig = { ...floatLeg, currency: 'EUR' }
  const xccy: SwapConfig = {
    type: 'XCCY',
    legs: [xccyLegUsd, xccyLegEur],
    tradeDate: new Date(2026, 3, 10),
    effectiveDate: schedule.startDate,
    maturityDate: schedule.endDate,
  }
  const ctxXccy: PricingContext = {
    curve,
    index: sofr,
    observations: [],
    book,
    fxSpots: { EURUSD: 1.1 },
    reportingCcy: 'USD',
  }

  test('returns (ccy × curveType × pillar) entries', () => {
    const entries = keyRateDv01(xccy, ctxXccy)
    expect(entries.length).toBe(12)
    const ccys = new Set(entries.map((e) => e.currency))
    expect(ccys).toEqual(new Set(['USD', 'EUR']))
    const types = new Set(entries.map((e) => e.curveType))
    expect(types).toEqual(new Set(['Discount', 'Projection']))
  })

  test('sum of KRD entries equals parallel DV01 within 1e-8·|NPV|', () => {
    const { dv01: parallel, npv } = pricingEngine.price(xccy, ctxXccy)
    const sumKrd = keyRateDv01(xccy, ctxXccy).reduce((s, e) => s + e.dv01, 0)
    expect(Math.abs(Math.abs(sumKrd) - parallel)).toBeLessThan(1e-8 * Math.max(Math.abs(npv), 1))
  })
})
