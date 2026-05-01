import { describe, expect, test } from 'vitest'
import { pricingEngine } from '../../engine/price.js'
import type {
  DiscountCurve,
  FixedLegConfig,
  PricingContext,
  ProtectionLegConfig,
  SwapConfig,
} from '../../engine/types.js'
import { bumpCreditSpread } from '../bump.js'
import { credit01 } from '../metrics.js'

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

const schedule = {
  startDate: new Date(2026, 3, 15),
  endDate: new Date(2027, 3, 15),
  frequency: 'Quarterly' as const,
}
const premiumLeg: FixedLegConfig = {
  legType: 'fixed',
  currency: 'USD',
  notional: 10e6,
  rate: 0.01,
  dayCount: 'ACT_360',
  schedule,
}
const protectionLeg: ProtectionLegConfig = {
  legType: 'protection',
  notional: 10e6,
  recoveryRate: 0.4,
}

describe('credit01', () => {
  test('is non-zero for CDS', () => {
    const cds: SwapConfig = {
      type: 'CDS',
      legs: [premiumLeg, protectionLeg],
      tradeDate: new Date(2026, 3, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const ctx: PricingContext = { curve, index: null, observations: [] }
    expect(Math.abs(credit01(cds, ctx))).toBeGreaterThan(0)
  })

  test('is 0 for IRS (no credit exposure)', () => {
    const irs: SwapConfig = {
      type: 'IRS',
      legs: [premiumLeg, premiumLeg],
      tradeDate: new Date(2026, 3, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const ctx: PricingContext = { curve, index: null, observations: [] }
    expect(credit01(irs, ctx)).toBe(0)
  })

  test('matches central-difference 1bp bump-reprice', () => {
    const cds: SwapConfig = {
      type: 'CDS',
      legs: [premiumLeg, protectionLeg],
      tradeDate: new Date(2026, 3, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const ctx: PricingContext = { curve, index: null, observations: [] }
    const up = pricingEngine.price(cds, bumpCreditSpread(ctx, +0.0001)).npv
    const down = pricingEngine.price(cds, bumpCreditSpread(ctx, -0.0001)).npv
    const expected = (up - down) / 2
    expect(credit01(cds, ctx)).toBeCloseTo(expected, 10)
  })
})
