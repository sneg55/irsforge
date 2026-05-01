import { describe, expect, test } from 'vitest'
import { FxSwapPricingStrategy } from '../strategies/fx-swap.js'
import type { DiscountCurve, FxLegConfig, PricingContext } from '../types.js'

const curve: DiscountCurve = {
  currency: 'USD',
  curveType: 'Discount',
  indexId: null,
  asOf: '2026-04-10T00:00:00Z',
  pillars: [
    { tenorDays: 91, zeroRate: 0.0431 },
    { tenorDays: 365, zeroRate: 0.0415 },
  ],
  interpolation: 'LinearZero',
  dayCount: 'Act360',
}
const ctx: PricingContext = { curve, index: null, observations: [] }

const nearLeg: FxLegConfig = {
  legType: 'fx',
  baseCurrency: 'USD',
  foreignCurrency: 'EUR',
  notional: 10_000_000,
  fxRate: 1.08,
  paymentDate: new Date(2026, 6, 15),
}
const farLeg: FxLegConfig = {
  legType: 'fx',
  baseCurrency: 'USD',
  foreignCurrency: 'EUR',
  notional: 10_000_000,
  fxRate: 1.085,
  paymentDate: new Date(2027, 3, 15),
}

describe('FX swap strategy', () => {
  const strategy = new FxSwapPricingStrategy()
  test('each leg generates 1 cashflow', () => {
    expect(strategy.calcLegCashflows(nearLeg, ctx)).toHaveLength(1)
    expect(strategy.calcLegCashflows(farLeg, ctx)).toHaveLength(1)
  })
  test('cashflow amount is notional * fxRate', () => {
    const cfs = strategy.calcLegCashflows(nearLeg, ctx)
    expect(cfs[0].amount).toBeCloseTo(10_000_000 * 1.08, 0)
  })
  test('PV is discounted cashflow', () => {
    const cfs = strategy.calcLegCashflows(nearLeg, ctx)
    const pv = strategy.calcLegPV(cfs, ctx)
    expect(pv).toBeGreaterThan(0)
    expect(pv).toBeLessThan(10_000_000 * 1.08) // discounted
  })
  test('returns empty array for non-fx leg types', () => {
    const bogus = { legType: 'fixed' } as unknown as FxLegConfig
    expect(strategy.calcLegCashflows(bogus, ctx)).toHaveLength(0)
  })
})
