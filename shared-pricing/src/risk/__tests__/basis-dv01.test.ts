import { describe, expect, test } from 'vitest'
import type {
  CurveBook,
  DiscountCurve,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  SwapConfig,
} from '../../engine/types.js'
import { basisDv01 } from '../metrics.js'

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

const schedule = {
  startDate: new Date(2026, 3, 15),
  endDate: new Date(2027, 3, 15),
  frequency: 'Quarterly' as const,
}
const sofr: FloatingRateIndex = {
  indexId: 'USD-SOFR',
  currency: 'USD',
  family: 'SOFR',
  compounding: 'CompoundedInArrears',
  lookback: 0,
  floor: null,
}
const fedFunds: FloatingRateIndex = { ...sofr, indexId: 'USD-FedFunds' }

const fixedLeg = {
  legType: 'fixed' as const,
  currency: 'USD',
  notional: 50e6,
  rate: 0.0425,
  dayCount: 'ACT_360' as const,
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

describe('basisDv01', () => {
  test('is 0 for single-curve IRS (no book)', () => {
    const irs: SwapConfig = {
      type: 'IRS',
      legs: [fixedLeg, floatLeg],
      tradeDate: new Date(2026, 3, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const ctx: PricingContext = { curve: mkCurve('USD', 'Discount'), index: sofr, observations: [] }
    expect(basisDv01(irs, ctx)).toBe(0)
  })

  test('is non-zero for BASIS swap with two different projection curves', () => {
    const book: CurveBook = {
      asOf: '2026-04-10T00:00:00Z',
      byCurrency: {
        USD: {
          discount: mkCurve('USD', 'Discount'),
          projections: {
            'USD-SOFR': mkCurve('USD', 'Projection'),
            'USD-FedFunds': mkCurve('USD', 'Projection'),
          },
        },
      },
    }
    const legA: FloatLegConfig = { ...floatLeg, indexId: 'SOFR' }
    const legB: FloatLegConfig = { ...floatLeg, indexId: 'FedFunds', spread: 0.001 }
    const basis: SwapConfig = {
      type: 'BASIS',
      legs: [legA, legB],
      tradeDate: new Date(2026, 3, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const ctx: PricingContext = {
      curve: mkCurve('USD', 'Discount'),
      index: sofr,
      indicesByLeg: [sofr, fedFunds],
      observations: [],
      book,
    }
    expect(Math.abs(basisDv01(basis, ctx))).toBeGreaterThan(0)
  })

  test('sign flips when leg direction flips (receive-SOFR vs pay-SOFR)', () => {
    // Sign-flip must be produced by negating the leg notionals; reversing
    // leg order alone is a no-op because BASIS NPV sums leg PVs. Same-sign
    // notionals here make the flip observable at full magnitude rather than
    // cancelling out in FP noise — `forward` is a two-long portfolio;
    // `backward` is the mirrored two-short portfolio.
    const book: CurveBook = {
      asOf: '2026-04-10T00:00:00Z',
      byCurrency: {
        USD: {
          discount: mkCurve('USD', 'Discount'),
          projections: {
            'USD-SOFR': mkCurve('USD', 'Projection'),
            'USD-FedFunds': mkCurve('USD', 'Projection'),
          },
        },
      },
    }
    const longSofr: FloatLegConfig = { ...floatLeg, notional: 50e6, indexId: 'SOFR' }
    const longFf: FloatLegConfig = {
      ...floatLeg,
      notional: 50e6,
      indexId: 'FedFunds',
      spread: 0.001,
    }
    const shortSofr: FloatLegConfig = { ...floatLeg, notional: -50e6, indexId: 'SOFR' }
    const shortFf: FloatLegConfig = {
      ...floatLeg,
      notional: -50e6,
      indexId: 'FedFunds',
      spread: 0.001,
    }
    const forward: SwapConfig = {
      type: 'BASIS',
      legs: [longSofr, longFf],
      tradeDate: new Date(2026, 3, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const backward: SwapConfig = { ...forward, legs: [shortSofr, shortFf] }
    const ctx: PricingContext = {
      curve: mkCurve('USD', 'Discount'),
      index: sofr,
      indicesByLeg: [sofr, fedFunds],
      observations: [],
      book,
    }
    const fwd = basisDv01(forward, ctx)
    const bwd = basisDv01(backward, ctx)
    expect(Math.sign(fwd)).toBe(-Math.sign(bwd))
    expect(Math.abs(fwd)).toBeGreaterThan(100)
  })
})
