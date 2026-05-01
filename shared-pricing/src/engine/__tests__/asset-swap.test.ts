import { describe, expect, test } from 'vitest'
import { AssetSwapPricingStrategy } from '../strategies/asset-swap.js'
import type {
  AssetLegConfig,
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  RateObservation,
} from '../types.js'

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

const sofrIndex: FloatingRateIndex = {
  indexId: 'USD-SOFR',
  currency: 'USD',
  family: 'SOFR',
  compounding: 'CompoundedInArrears',
  lookback: 0,
  floor: null,
}

const floatSchedule = {
  startDate: new Date(2026, 3, 15),
  endDate: new Date(2027, 3, 15),
  frequency: 'Quarterly' as const,
}

const assetLeg: AssetLegConfig = {
  legType: 'asset',
  notional: 10_000_000,
  underlyings: [
    { assetId: 'AAPL', weight: 0.6, initialPrice: 150, currentPrice: 165 },
    { assetId: 'MSFT', weight: 0.4, initialPrice: 400, currentPrice: 420 },
  ],
}

const rateLeg: FixedLegConfig = {
  legType: 'fixed',
  currency: 'USD',
  notional: 10_000_000,
  rate: 0.03,
  dayCount: 'ACT_360',
  schedule: {
    startDate: new Date(2026, 3, 15),
    endDate: new Date(2027, 3, 15),
    frequency: 'Quarterly',
  },
}

const floatLeg: FloatLegConfig = {
  legType: 'float',
  currency: 'USD',
  notional: 10_000_000,
  indexId: 'USD-SOFR',
  spread: 0,
  dayCount: 'ACT_360',
  schedule: floatSchedule,
}

describe('Asset swap strategy', () => {
  const strategy = new AssetSwapPricingStrategy()
  test('asset leg generates 1 cashflow based on return', () => {
    const cfs = strategy.calcLegCashflows(assetLeg, ctx)
    expect(cfs).toHaveLength(1)
    // Weighted return: 0.6*(165-150)/150 + 0.4*(420-400)/400 = 0.06 + 0.02 = 0.08
    // Amount: 10M * 0.08 = 800,000
    expect(cfs[0].amount).toBeCloseTo(800_000, 0)
  })
  test('rate leg generates quarterly cashflows', () => {
    expect(strategy.calcLegCashflows(rateLeg, ctx)).toHaveLength(4)
  })
  test('asset leg PV is discounted return', () => {
    const cfs = strategy.calcLegCashflows(assetLeg, ctx)
    const pv = strategy.calcLegPV(cfs, ctx)
    expect(pv).toBeGreaterThan(0)
  })
  test('returns empty array for unsupported leg types', () => {
    const bogus = { legType: 'protection' } as unknown as AssetLegConfig
    expect(strategy.calcLegCashflows(bogus, ctx)).toHaveLength(0)
  })

  test('asset leg with zero return produces a zero-amount cashflow', () => {
    const flat: AssetLegConfig = {
      legType: 'asset',
      notional: 10_000_000,
      underlyings: [{ assetId: 'AAPL', weight: 1, initialPrice: 150, currentPrice: 150 }],
    }
    const cfs = strategy.calcLegCashflows(flat, ctx)
    expect(cfs).toHaveLength(1)
    expect(cfs[0].amount).toBe(0)
    expect(strategy.calcLegPV(cfs, ctx)).toBe(0)
  })

  test('asset leg with negative return produces a negative cashflow', () => {
    const lossy: AssetLegConfig = {
      legType: 'asset',
      notional: 10_000_000,
      underlyings: [{ assetId: 'AAPL', weight: 1, initialPrice: 200, currentPrice: 150 }],
    }
    const cfs = strategy.calcLegCashflows(lossy, ctx)
    // Return = (150-200)/200 = -0.25 → 10M * -0.25 = -2,500,000
    expect(cfs[0].amount).toBeCloseTo(-2_500_000, 0)
    const pv = strategy.calcLegPV(cfs, ctx)
    expect(pv).toBeLessThan(0)
  })

  test('asset-leg maturity falls on the last curve pillar (1826 days)', () => {
    const cfs = strategy.calcLegCashflows(assetLeg, ctx)
    const valueDate = new Date(ctx.curve.asOf)
    const expectedMaturity = new Date(valueDate.getTime() + 1826 * 86400000)
    expect(cfs[0].date.getTime()).toBe(expectedMaturity.getTime())
  })

  test('asset-leg maturity falls back to 365 days when curve has no pillars', () => {
    const emptyCurve: DiscountCurve = { ...curve, pillars: [] }
    const emptyCtx: PricingContext = { curve: emptyCurve, index: null, observations: [] }
    const cfs = strategy.calcLegCashflows(assetLeg, emptyCtx)
    const valueDate = new Date(emptyCurve.asOf)
    const expectedMaturity = new Date(valueDate.getTime() + 365 * 86400000)
    expect(cfs[0].date.getTime()).toBe(expectedMaturity.getTime())
  })

  test('float leg without index falls back to forward projection (4 quarterly cashflows)', () => {
    const cfs = strategy.calcLegCashflows(floatLeg, ctx)
    expect(cfs).toHaveLength(4)
    cfs.forEach((cf) => expect(cf.amount).toBeGreaterThan(0))
  })

  test('float leg with index uses compounded-in-arrears projection and tags projected rate', () => {
    const ctxWithIndex: PricingContext = { curve, index: sofrIndex, observations: [] }
    const cfs = strategy.calcLegCashflows(floatLeg, ctxWithIndex)
    expect(cfs).toHaveLength(4)
    cfs.forEach((cf) => {
      expect(cf.projectedRate).toBeDefined()
      expect(cf.projectedRate).toBeGreaterThan(0)
    })
  })

  test('float leg with realised observations honours the published rates', () => {
    // Publish daily SOFR observations for the first quarter.
    const observations: RateObservation[] = []
    let cursor = new Date(floatSchedule.startDate)
    const firstPeriodEnd = new Date(floatSchedule.startDate)
    firstPeriodEnd.setMonth(firstPeriodEnd.getMonth() + 3)
    while (cursor < firstPeriodEnd) {
      observations.push({ date: new Date(cursor), rate: 0.05 })
      cursor = new Date(cursor.getTime() + 86400000)
    }
    const ctxWithObs: PricingContext = { curve, index: sofrIndex, observations }
    const cfs = strategy.calcLegCashflows(floatLeg, ctxWithObs)
    expect(cfs).toHaveLength(4)
    // First period has realised observations — projectedRate close to 5%.
    expect(cfs[0].projectedRate ?? 0).toBeGreaterThan(0.04)
    expect(cfs[0].projectedRate ?? 0).toBeLessThan(0.06)
  })

  test('float-leg PV is positive over future periods', () => {
    const ctxWithIndex: PricingContext = { curve, index: sofrIndex, observations: [] }
    const cfs = strategy.calcLegCashflows(floatLeg, ctxWithIndex)
    const pv = strategy.calcLegPV(cfs, ctxWithIndex)
    expect(pv).toBeGreaterThan(0)
    expect(Number.isFinite(pv)).toBe(true)
  })

  test('calcLegPV honours ctx.valueDate cutoff and skips already-settled flows', () => {
    const cfs = strategy.calcLegCashflows(rateLeg, ctx)
    expect(cfs).toHaveLength(4)
    const fullPv = strategy.calcLegPV(cfs, ctx)
    // Move the forward-NPV horizon past the second cashflow — the strategy
    // should drop the first two cashflows and only discount the remaining two.
    const cutoff = new Date(cfs[1].date.getTime() + 86400000)
    const horizonPv = strategy.calcLegPV(cfs, { ...ctx, valueDate: cutoff })
    expect(horizonPv).toBeLessThan(fullPv)
    expect(horizonPv).toBeGreaterThan(0)
  })

  test('calcLegPV with valueDate beyond all cashflows returns zero', () => {
    const cfs = strategy.calcLegCashflows(rateLeg, ctx)
    const beyond = new Date(cfs[cfs.length - 1].date.getTime() + 86400000)
    const pv = strategy.calcLegPV(cfs, { ...ctx, valueDate: beyond })
    expect(pv).toBe(0)
  })
})
