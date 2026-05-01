import { describe, expect, it } from 'vitest'
import type { DiscountCurve, PricingContext, SwapConfig } from '../../types.js'
import { CdsPricingStrategy } from '../cds.js'

describe('CDS protection leg maturity', () => {
  it('anchors protection cashflow to config.maturityDate, not curve last pillar', () => {
    const strategy = new CdsPricingStrategy()
    const maturity = new Date('2031-04-21T00:00:00Z')
    const ctx: PricingContext = {
      curve: {
        currency: 'USD',
        curveType: 'Discount',
        indexId: null,
        asOf: '2026-04-21T00:00:00Z',
        pillars: [
          { tenorDays: 1, zeroRate: 0.05 },
          { tenorDays: 3652, zeroRate: 0.05 },
        ],
        interpolation: 'LinearZero',
        dayCount: 'Act360',
      },
      index: null,
      observations: [],
      creditSpread: 0.02,
    }
    const config: SwapConfig = {
      type: 'CDS',
      tradeDate: new Date('2026-04-21T00:00:00Z'),
      effectiveDate: new Date('2026-04-21T00:00:00Z'),
      maturityDate: maturity,
      legs: [
        {
          legType: 'fixed',
          direction: 'pay',
          currency: 'USD',
          notional: 10_000_000,
          rate: 0.01,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date('2026-04-21'),
            endDate: maturity,
            frequency: 'Quarterly',
          },
        },
        {
          legType: 'protection',
          direction: 'receive',
          notional: 10_000_000,
          recoveryRate: 0.4,
        },
      ],
    }
    const cfs = strategy.calcLegCashflows(config.legs[1], ctx, 1, config)
    expect(cfs).toHaveLength(1)
    // Within 2 days of maturity (day-math rounding)
    expect(Math.abs(cfs[0].date.getTime() - maturity.getTime())).toBeLessThan(2 * 86_400_000)
  })

  it('uses exponential survival, not linear', () => {
    const strategy = new CdsPricingStrategy()
    const longMaturity = new Date('2076-04-21T00:00:00Z') // 50y out
    const ctx: PricingContext = {
      curve: {
        currency: 'USD',
        curveType: 'Discount',
        indexId: null,
        asOf: '2026-04-21T00:00:00Z',
        pillars: [
          { tenorDays: 1, zeroRate: 0.05 },
          { tenorDays: 18260, zeroRate: 0.05 },
        ],
        interpolation: 'LinearZero',
        dayCount: 'Act360',
      },
      index: null,
      observations: [],
      creditSpread: 0.05, // 5% hazard — linear clips to zero before 50y
    }
    const config: SwapConfig = {
      type: 'CDS',
      tradeDate: new Date('2026-04-21'),
      effectiveDate: new Date('2026-04-21'),
      maturityDate: longMaturity,
      legs: [
        {
          legType: 'fixed',
          direction: 'pay',
          currency: 'USD',
          notional: 10_000_000,
          rate: 0.01,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date('2026-04-21'),
            endDate: longMaturity,
            frequency: 'Quarterly',
          },
        },
        { legType: 'protection', direction: 'receive', notional: 10_000_000, recoveryRate: 0.4 },
      ],
    }
    const cfs = strategy.calcLegCashflows(config.legs[1], ctx, 1, config)
    // With exponential survival at hazard=0.05, t=50: defaultProb = 1 - exp(-2.5) ≈ 0.918
    // amount = 10M * (1 - 0.4) * 0.918 = ~5.5M
    // Linear would clip at 1.0 → amount = 6M exactly. Exponential < linear.
    expect(cfs[0].amount).toBeGreaterThan(5_000_000)
    expect(cfs[0].amount).toBeLessThan(5_700_000) // strictly below the 6M linear cap
  })
})
