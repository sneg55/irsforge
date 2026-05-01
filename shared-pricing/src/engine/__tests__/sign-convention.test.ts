import { describe, expect, it } from 'vitest'
import { pricingEngine } from '../price.js'
import type { DiscountCurve, PricingContext, SwapConfig } from '../types.js'

const flatCurve: DiscountCurve = {
  currency: 'USD',
  curveType: 'Discount',
  indexId: null,
  asOf: '2026-01-01T00:00:00Z',
  pillars: [
    { tenorDays: 1, zeroRate: 0.05 },
    { tenorDays: 3652, zeroRate: 0.05 },
  ],
  interpolation: 'LinearZero',
  dayCount: 'Act360',
}

describe('engine sign convention', () => {
  it('receive-fixed pay-float at fixed=curve ⇒ NPV ≈ 0', () => {
    const config: SwapConfig = {
      type: 'IRS',
      tradeDate: new Date('2026-01-01'),
      effectiveDate: new Date('2026-01-01'),
      maturityDate: new Date('2031-01-01'),
      legs: [
        {
          legType: 'fixed',
          direction: 'receive',
          currency: 'USD',
          notional: 10_000_000,
          rate: 0.05,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date('2026-01-01'),
            endDate: new Date('2031-01-01'),
            frequency: 'Quarterly',
          },
        },
        {
          legType: 'float',
          direction: 'pay',
          currency: 'USD',
          notional: 10_000_000,
          indexId: 'USD-SOFR',
          spread: 0,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date('2026-01-01'),
            endDate: new Date('2031-01-01'),
            frequency: 'Quarterly',
          },
        },
      ],
    }
    const ctx: PricingContext = { curve: flatCurve, index: null, observations: [] }
    const v = pricingEngine.price(config, ctx)
    expect(Math.abs(v.npv)).toBeLessThan(1_000) // near zero on flat curve
  })

  it('par rate on receive-fixed IRS against 5% curve ≈ 5%', () => {
    const config: SwapConfig = {
      type: 'IRS',
      tradeDate: new Date('2026-01-01'),
      effectiveDate: new Date('2026-01-01'),
      maturityDate: new Date('2031-01-01'),
      legs: [
        {
          legType: 'fixed',
          direction: 'receive',
          currency: 'USD',
          notional: 10_000_000,
          rate: 0.04,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date('2026-01-01'),
            endDate: new Date('2031-01-01'),
            frequency: 'Quarterly',
          },
        },
        {
          legType: 'float',
          direction: 'pay',
          currency: 'USD',
          notional: 10_000_000,
          indexId: 'USD-SOFR',
          spread: 0,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date('2026-01-01'),
            endDate: new Date('2031-01-01'),
            frequency: 'Quarterly',
          },
        },
      ],
    }
    const ctx: PricingContext = { curve: flatCurve, index: null, observations: [] }
    const v = pricingEngine.price(config, ctx)
    expect(v.parRate).not.toBeNull()
    expect(v.parRate!).toBeGreaterThan(0.045)
    expect(v.parRate!).toBeLessThan(0.055)
  })
})
