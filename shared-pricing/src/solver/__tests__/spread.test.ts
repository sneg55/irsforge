import { describe, expect, test } from 'vitest'
import { pricingEngine } from '../../engine/price.js'
import type {
  CurveBook,
  DiscountCurve,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  SwapConfig,
} from '../../engine/types.js'
import { solveSpread } from '../spread.js'

const mkCurve = (curveType: 'Discount' | 'Projection'): DiscountCurve => ({
  currency: 'USD',
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
const fedFunds: FloatingRateIndex = { ...sofr, indexId: 'USD-FedFunds' }

const schedule = {
  startDate: new Date(2026, 3, 15),
  endDate: new Date(2027, 3, 15),
  frequency: 'Quarterly' as const,
}
const legA: FloatLegConfig = {
  legType: 'float',
  currency: 'USD',
  notional: 50e6,
  indexId: 'SOFR',
  spread: 0,
  dayCount: 'ACT_360',
  schedule,
}
const legB: FloatLegConfig = {
  legType: 'float',
  currency: 'USD',
  notional: -50e6,
  indexId: 'FedFunds',
  spread: 0.001,
  dayCount: 'ACT_360',
  schedule,
}

const book: CurveBook = {
  asOf: '2026-04-10T00:00:00Z',
  byCurrency: {
    USD: {
      discount: mkCurve('Discount'),
      projections: { 'USD-SOFR': mkCurve('Projection'), 'USD-FedFunds': mkCurve('Projection') },
    },
  },
}

const basis: SwapConfig = {
  type: 'BASIS',
  legs: [legA, legB],
  tradeDate: new Date(2026, 3, 10),
  effectiveDate: schedule.startDate,
  maturityDate: schedule.endDate,
}

const ctx: PricingContext = {
  curve: mkCurve('Discount'),
  index: sofr,
  indicesByLeg: [sofr, fedFunds],
  observations: [],
  book,
}

describe('solveSpread', () => {
  test('plug solved spread back → NPV = 0 within 1e-8·|N| (legB)', () => {
    const s = solveSpread(basis, ctx, 1)
    const legs: SwapConfig['legs'] = [legA, { ...legB, spread: s }]
    const { npv } = pricingEngine.price({ ...basis, legs }, ctx)
    expect(Math.abs(npv)).toBeLessThan(1e-8 * Math.abs(legB.notional))
  })

  test('plug solved spread back → NPV = 0 within 1e-8·|N| (legA)', () => {
    const s = solveSpread(basis, ctx, 0)
    const legs: SwapConfig['legs'] = [{ ...legA, spread: s }, legB]
    const { npv } = pricingEngine.price({ ...basis, legs }, ctx)
    expect(Math.abs(npv)).toBeLessThan(1e-8 * Math.abs(legA.notional))
  })

  test('throws when legIndex is out of range', () => {
    expect(() => solveSpread(basis, ctx, 5)).toThrow()
  })

  test('throws when the target leg is not float', () => {
    const irsLike: SwapConfig = {
      ...basis,
      type: 'IRS',
      legs: [
        {
          legType: 'fixed',
          currency: 'USD',
          notional: 50e6,
          rate: 0.04,
          dayCount: 'ACT_360',
          schedule,
        },
        legB,
      ],
    }
    expect(() => solveSpread(irsLike, ctx, 0)).toThrow()
  })
})
