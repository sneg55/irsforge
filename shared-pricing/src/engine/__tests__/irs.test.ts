import { describe, expect, test } from 'vitest'
import { IrsPricingStrategy } from '../strategies/irs.js'
import type {
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
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

describe('IRS strategy', () => {
  const strategy = new IrsPricingStrategy()

  test('fixed leg generates 4 cashflows', () => {
    expect(strategy.calcLegCashflows(fixedLeg, ctx)).toHaveLength(4)
  })

  test('float leg generates 4 cashflows with implied projected rates', () => {
    const cfs = strategy.calcLegCashflows(floatLeg, ctx)
    expect(cfs).toHaveLength(4)
    expect(cfs[0].projectedRate).toBeDefined()
    expect(cfs[0].projectedRate).toBeGreaterThan(0)
  })

  test('leg PV is sum of discounted cashflows', () => {
    const cfs = strategy.calcLegCashflows(fixedLeg, ctx)
    const pv = strategy.calcLegPV(cfs, ctx)
    expect(pv).not.toBe(0)
    expect(typeof pv).toBe('number')
    expect(Number.isFinite(pv)).toBe(true)
  })

  test('fixed leg PV is positive (receiving discounted coupons)', () => {
    const cfs = strategy.calcLegCashflows(fixedLeg, ctx)
    const pv = strategy.calcLegPV(cfs, ctx)
    expect(pv).toBeGreaterThan(0)
  })

  test('float leg without index falls back to forward-projection (backwards compat)', () => {
    const ctxNoIndex: PricingContext = { curve, index: null, observations: [] }
    const cfs = strategy.calcLegCashflows(floatLeg, ctxNoIndex)
    expect(cfs).toHaveLength(4)
    expect(cfs[0].projectedRate).toBeGreaterThan(0)
  })
})
