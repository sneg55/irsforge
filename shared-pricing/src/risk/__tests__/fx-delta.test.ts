import { describe, expect, test } from 'vitest'
import type {
  CurveBook,
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  SwapConfig,
} from '../../engine/types.js'
import { fxDelta } from '../metrics.js'

const mkCurve = (ccy: string, curveType: 'Discount' | 'Projection'): DiscountCurve => ({
  currency: ccy,
  curveType,
  indexId: null,
  asOf: '2026-04-10T00:00:00Z',
  pillars: [
    { tenorDays: 91, zeroRate: 0.0431 },
    { tenorDays: 365, zeroRate: 0.0415 },
    { tenorDays: 1826, zeroRate: 0.0387 },
  ],
  interpolation: 'LinearZero',
  dayCount: 'Act360',
})

const sofr: FloatingRateIndex = {
  indexId: 'USD-SOFR',
  currency: 'USD',
  family: 'SOFR',
  compounding: 'CompoundedInArrears',
  lookback: 0,
  floor: null,
}

const schedule = {
  startDate: new Date(2026, 3, 15),
  endDate: new Date(2027, 3, 15),
  frequency: 'Quarterly' as const,
}

describe('fxDelta', () => {
  test('returns empty array for single-currency IRS', () => {
    const fixedLeg: FixedLegConfig = {
      legType: 'fixed',
      currency: 'USD',
      notional: 50e6,
      rate: 0.0425,
      dayCount: 'ACT_360',
      schedule,
    }
    const floatLeg: FloatLegConfig = {
      legType: 'float',
      currency: 'USD',
      notional: 50e6,
      indexId: 'SOFR',
      spread: 0,
      dayCount: 'ACT_360',
      schedule,
    }
    const irs: SwapConfig = {
      type: 'IRS',
      legs: [fixedLeg, floatLeg],
      tradeDate: new Date(2026, 3, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const ctx: PricingContext = { curve: mkCurve('USD', 'Discount'), index: sofr, observations: [] }
    expect(fxDelta(irs, ctx)).toEqual([])
  })

  test('returns per-pair delta for XCCY', () => {
    const usdLeg: FixedLegConfig = {
      legType: 'fixed',
      currency: 'USD',
      notional: 50e6,
      rate: 0.0425,
      dayCount: 'ACT_360',
      schedule,
    }
    const eurLeg: FloatLegConfig = {
      legType: 'float',
      currency: 'EUR',
      notional: -50e6,
      indexId: 'SOFR',
      spread: 0,
      dayCount: 'ACT_360',
      schedule,
    }
    const book: CurveBook = {
      asOf: '2026-04-10T00:00:00Z',
      byCurrency: {
        USD: {
          discount: mkCurve('USD', 'Discount'),
          projections: { 'USD-SOFR': mkCurve('USD', 'Projection') },
        },
        EUR: {
          discount: mkCurve('EUR', 'Discount'),
          projections: { 'EUR-ESTR': mkCurve('EUR', 'Projection') },
        },
      },
    }
    const xccy: SwapConfig = {
      type: 'XCCY',
      legs: [usdLeg, eurLeg],
      tradeDate: new Date(2026, 3, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const ctx: PricingContext = {
      curve: mkCurve('USD', 'Discount'),
      index: sofr,
      observations: [],
      book,
      fxSpots: { EURUSD: 1.1 },
      reportingCcy: 'USD',
    }
    const out = fxDelta(xccy, ctx)
    expect(out).toHaveLength(1)
    expect(out[0].pair).toBe('EURUSD')
    expect(Math.abs(out[0].delta)).toBeGreaterThan(0)
  })
})
