import { describe, expect, test } from 'vitest'
import { CcySwapPricingStrategy } from '../strategies/ccy-swap.js'
import type { DiscountCurve, FixedLegConfig, PricingContext } from '../types.js'

const curve: DiscountCurve = {
  currency: 'USD',
  curveType: 'Discount',
  indexId: null,
  asOf: '2026-04-10T00:00:00Z',
  pillars: [
    { tenorDays: 365, zeroRate: 0.0415 },
    { tenorDays: 1826, zeroRate: 0.0387 },
  ],
  interpolation: 'LinearZero',
  dayCount: 'Act360',
}
const ctx: PricingContext = { curve, index: null, observations: [] }

const baseLeg: FixedLegConfig = {
  legType: 'fixed',
  currency: 'USD',
  notional: 50_000_000,
  rate: 0.04,
  dayCount: 'ACT_360',
  schedule: {
    startDate: new Date(2026, 3, 15),
    endDate: new Date(2031, 3, 15),
    frequency: 'Quarterly',
  },
}

const foreignLeg: FixedLegConfig = {
  legType: 'fixed',
  currency: 'EUR',
  notional: 45_000_000,
  rate: 0.035,
  dayCount: 'ACT_360',
  schedule: {
    startDate: new Date(2026, 3, 15),
    endDate: new Date(2031, 3, 15),
    frequency: 'Quarterly',
  },
}

describe('CCY swap strategy', () => {
  const strategy = new CcySwapPricingStrategy()

  test('generates cashflows for fixed leg', () => {
    const cfs = strategy.calcLegCashflows(baseLeg, ctx)
    expect(cfs.length).toBe(20)
  })

  test('both legs have positive PV (receiving coupons)', () => {
    const baseCfs = strategy.calcLegCashflows(baseLeg, ctx)
    const foreignCfs = strategy.calcLegCashflows(foreignLeg, ctx)
    expect(strategy.calcLegPV(baseCfs, ctx)).toBeGreaterThan(0)
    expect(strategy.calcLegPV(foreignCfs, ctx)).toBeGreaterThan(0)
  })

  test('different notionals produce different PVs', () => {
    const baseCfs = strategy.calcLegCashflows(baseLeg, ctx)
    const foreignCfs = strategy.calcLegCashflows(foreignLeg, ctx)
    const basePV = strategy.calcLegPV(baseCfs, ctx)
    const foreignPV = strategy.calcLegPV(foreignCfs, ctx)
    expect(basePV).not.toEqual(foreignPV)
  })
})
