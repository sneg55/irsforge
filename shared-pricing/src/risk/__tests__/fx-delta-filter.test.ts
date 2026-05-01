import { describe, expect, it } from 'vitest'
import type { DiscountCurve, PricingContext, SwapConfig } from '../../engine/types.js'
import { fxDelta } from '../metrics.js'

const usdCurve: DiscountCurve = {
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

describe('fxDelta pair filter', () => {
  it('returns empty list for pure-USD IRS', () => {
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
    const ctx: PricingContext = {
      curve: usdCurve,
      index: null,
      observations: [],
      fxSpots: { EURUSD: 1.08, GBPUSD: 1.25 },
    }
    expect(fxDelta(config, ctx)).toEqual([])
  })
})
