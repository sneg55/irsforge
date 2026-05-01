import { describe, expect, it } from 'vitest'
import { pricingEngine } from '../../engine/price.js'
import type { DiscountCurve, PricingContext, SwapConfig } from '../../engine/types.js'
import { theta } from '../time.js'

const flatUsd: DiscountCurve = {
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
const flatEur: DiscountCurve = {
  ...flatUsd,
  currency: 'EUR',
  pillars: [
    { tenorDays: 1, zeroRate: 0.03 },
    { tenorDays: 3652, zeroRate: 0.03 },
  ],
}

describe('XCCY theta excludes settled notional exchange', () => {
  it('theta "next fix" stays within 2x NPV magnitude', () => {
    const config: SwapConfig = {
      type: 'XCCY',
      tradeDate: new Date('2026-01-01'),
      effectiveDate: new Date('2026-01-01'),
      maturityDate: new Date('2031-01-01'),
      legs: [
        {
          legType: 'fixed',
          direction: 'receive',
          currency: 'USD',
          notional: 50_000_000,
          rate: 0.04,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date('2026-01-01'),
            endDate: new Date('2031-01-01'),
            frequency: 'SemiAnnual',
          },
        },
        {
          legType: 'float',
          direction: 'pay',
          currency: 'EUR',
          notional: 45_000_000,
          indexId: 'EUR-ESTR',
          spread: 0,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date('2026-01-01'),
            endDate: new Date('2031-01-01'),
            frequency: 'SemiAnnual',
          },
        },
      ],
    }

    const ctx: PricingContext = {
      curve: flatUsd,
      index: null,
      observations: [],
      fxSpots: { EURUSD: 1.08 },
      reportingCcy: 'USD',
      book: {
        asOf: flatUsd.asOf,
        byCurrency: {
          USD: { discount: flatUsd, projections: { 'USD-SOFR': flatUsd } },
          EUR: { discount: flatEur, projections: { 'EUR-ESTR': flatEur } },
        },
      },
    }

    const npv = pricingEngine.price(config, ctx).npv
    const t = theta(config, ctx, { kind: 'deltaSeconds', seconds: 86400 })

    // Before fix: t > 50M because today's initial exchange falls off.
    // After fix: t is on the order of single-day discount bleed (~thousands).
    expect(Math.abs(t)).toBeLessThan(Math.max(100_000, Math.abs(npv) * 2))
  })
})
