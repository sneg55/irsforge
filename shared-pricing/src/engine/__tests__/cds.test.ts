import { describe, expect, test } from 'vitest'
import { CdsPricingStrategy } from '../strategies/cds.js'
import type {
  DiscountCurve,
  FixedLegConfig,
  PricingContext,
  ProtectionLegConfig,
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

const premiumLeg: FixedLegConfig = {
  legType: 'fixed',
  currency: 'USD',
  notional: 10_000_000,
  rate: 0.01,
  dayCount: 'ACT_360',
  schedule: {
    startDate: new Date(2026, 3, 15),
    endDate: new Date(2031, 3, 15),
    frequency: 'Quarterly',
  },
}

const protectionLeg: ProtectionLegConfig = {
  legType: 'protection',
  notional: 10_000_000,
  recoveryRate: 0.4,
}

describe('CDS strategy', () => {
  const strategy = new CdsPricingStrategy()

  test('premium leg generates quarterly cashflows', () => {
    const cfs = strategy.calcLegCashflows(premiumLeg, ctx)
    expect(cfs.length).toBe(20) // 5 years quarterly
  })

  test('premium leg PV is positive (receiving premium)', () => {
    const cfs = strategy.calcLegCashflows(premiumLeg, ctx)
    const pv = strategy.calcLegPV(cfs, ctx)
    expect(pv).toBeGreaterThan(0)
  })

  test('protection leg generates single contingent cashflow', () => {
    const cfs = strategy.calcLegCashflows(protectionLeg, ctx)
    expect(cfs.length).toBe(1)
  })

  test('protection leg PV represents expected loss', () => {
    const cfs = strategy.calcLegCashflows(protectionLeg, ctx)
    const pv = strategy.calcLegPV(cfs, ctx)
    // Expected loss = notional * (1 - recovery) * defaultProb * DF
    expect(pv).toBeGreaterThan(0)
    expect(pv).toBeLessThan(10_000_000 * 0.6) // less than max loss
  })
})
