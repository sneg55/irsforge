import { describe, expect, test } from 'vitest'
import { FpmlPricingStrategy } from '../strategies/fpml.js'
import type {
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  FxLegConfig,
  PricingContext,
} from '../types.js'

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

const sofrIndex: FloatingRateIndex = {
  indexId: 'USD-SOFR',
  currency: 'USD',
  family: 'SOFR',
  compounding: 'CompoundedInArrears',
  lookback: 0,
  floor: null,
}
const ctx: PricingContext = { curve, index: sofrIndex, observations: [] }

const schedule = {
  startDate: new Date(2026, 3, 15),
  endDate: new Date(2027, 3, 15),
  frequency: 'Quarterly' as const,
}

const floatLeg1: FloatLegConfig = {
  legType: 'float',
  currency: 'USD',
  notional: 50e6,
  indexId: 'SOFR',
  spread: 0,
  dayCount: 'ACT_360',
  schedule,
}

const fixedLeg: FixedLegConfig = {
  legType: 'fixed',
  currency: 'USD',
  notional: 10e6,
  rate: 0.03,
  dayCount: 'ACT_360',
  schedule,
}

describe('FpML strategy', () => {
  const strategy = new FpmlPricingStrategy()

  test('handles float leg (delegates correctly)', () => {
    const cfs = strategy.calcLegCashflows(floatLeg1, ctx)
    expect(cfs.length).toBe(4)
    expect(cfs[0].projectedRate).toBeDefined()
  })

  test('handles fixed leg (delegates correctly)', () => {
    const cfs = strategy.calcLegCashflows(fixedLeg, ctx)
    expect(cfs.length).toBe(4)
    expect(cfs[0].projectedRate).toBeUndefined()
  })

  test('calcLegPV works for any leg type', () => {
    const floatCfs = strategy.calcLegCashflows(floatLeg1, ctx)
    const fixedCfs = strategy.calcLegCashflows(fixedLeg, ctx)
    expect(strategy.calcLegPV(floatCfs, ctx)).toBeGreaterThan(0)
    expect(strategy.calcLegPV(fixedCfs, ctx)).toBeGreaterThan(0)
  })

  test('handles FX leg type', () => {
    const fxLeg: FxLegConfig = {
      legType: 'fx',
      baseCurrency: 'USD',
      foreignCurrency: 'EUR',
      notional: 10e6,
      fxRate: 1.08,
      paymentDate: new Date(2026, 9, 15),
    }
    const cfs = strategy.calcLegCashflows(fxLeg, ctx)
    expect(cfs.length).toBe(1)
    expect(cfs[0].amount).toBeCloseTo(10e6 * 1.08, 0)
  })
})
