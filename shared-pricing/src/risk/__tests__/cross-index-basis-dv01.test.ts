import { describe, expect, it } from 'vitest'
import type { CurveBook, DiscountCurve, PricingContext, SwapConfig } from '../../engine/types.js'
import { crossIndexBasisDv01 } from '../metrics.js'

function makeCurve(currency: string, indexId: string | null, zeroRate: number): DiscountCurve {
  return {
    currency,
    curveType: indexId ? 'Projection' : 'Discount',
    indexId,
    asOf: '2026-01-01T00:00:00Z',
    pillars: [
      { tenorDays: 1, zeroRate },
      { tenorDays: 365, zeroRate },
      { tenorDays: 1826, zeroRate },
      { tenorDays: 3652, zeroRate },
    ],
    interpolation: 'LinearZero',
    dayCount: 'Act360',
  }
}

const usdDiscount = makeCurve('USD', null, 0.04)
const sofrProj = makeCurve('USD', 'USD-SOFR', 0.05)
const effrProj = makeCurve('USD', 'USD-EFFR', 0.03)

const book: CurveBook = {
  asOf: '2026-01-01T00:00:00Z',
  byCurrency: {
    USD: {
      discount: usdDiscount,
      projections: {
        'USD-SOFR': sofrProj,
        'USD-EFFR': effrProj,
      },
    },
  },
}

// BASIS swap: SOFR vs EFFR
const basisConfig: SwapConfig = {
  type: 'BASIS',
  tradeDate: new Date('2026-01-01'),
  effectiveDate: new Date('2026-01-01'),
  maturityDate: new Date('2031-01-01'),
  legs: [
    {
      legType: 'float',
      direction: 'receive',
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
    {
      legType: 'float',
      direction: 'pay',
      currency: 'USD',
      notional: 10_000_000,
      indexId: 'USD-EFFR',
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
  curve: usdDiscount,
  index: null,
  observations: [],
  book,
}

describe('crossIndexBasisDv01', () => {
  it('returns null when no book is present', () => {
    const ctxNoBook: PricingContext = { curve: usdDiscount, index: null, observations: [] }
    expect(crossIndexBasisDv01(basisConfig, ctxNoBook, 'USD', 'USD-SOFR')).toBeNull()
  })

  it('is non-zero on BASIS swap when projections differ', () => {
    const d = crossIndexBasisDv01(basisConfig, ctx, 'USD', 'USD-SOFR')
    expect(d).not.toBeNull()
    expect(Math.abs(d!)).toBeGreaterThan(0)
  })

  it('SOFR and EFFR sensitivities are opposite in sign on a SOFR-receive/EFFR-pay swap', () => {
    const dSofr = crossIndexBasisDv01(basisConfig, ctx, 'USD', 'USD-SOFR')
    const dEffr = crossIndexBasisDv01(basisConfig, ctx, 'USD', 'USD-EFFR')
    expect(dSofr).not.toBeNull()
    expect(dEffr).not.toBeNull()
    // receive-SOFR: higher SOFR rate → higher receive coupon → positive DV01
    // pay-EFFR: higher EFFR rate → higher pay coupon → negative DV01
    expect(dSofr!).toBeGreaterThan(0)
    expect(dEffr!).toBeLessThan(0)
  })
})
