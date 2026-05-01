import { describe, expect, test } from 'vitest'
import { pricingEngine } from '../../engine/price.js'
import type {
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  SwapConfig,
} from '../../engine/types.js'
import { solveParRate } from '../par-rate.js'

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
  notional: -50e6,
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
const ctx: PricingContext = { curve, index: sofr, observations: [] }

describe('solveParRate', () => {
  test('matches engine closed-form for a vanilla IRS (1e-10)', () => {
    const closed = pricingEngine.price(irs, ctx).parRate!
    const solved = solveParRate(irs, ctx)
    expect(solved).toBeCloseTo(closed, 10)
  })

  test('plug solved rate back → NPV = 0 within 1e-8·|N|', () => {
    const solved = solveParRate(irs, ctx)
    const at: SwapConfig = { ...irs, legs: [{ ...fixedLeg, rate: solved }, floatLeg] }
    const { npv } = pricingEngine.price(at, ctx)
    expect(Math.abs(npv)).toBeLessThan(1e-8 * Math.abs(fixedLeg.notional))
  })

  test('throws when no fixed leg exists', () => {
    const noFixed: SwapConfig = {
      ...irs,
      legs: [floatLeg, { ...floatLeg, indexId: 'FedFunds' } as FloatLegConfig],
    }
    expect(() => solveParRate(noFixed, { ...ctx, indicesByLeg: [sofr, sofr] })).toThrow()
  })

  test('OIS (annual fixed vs compounded SOFR) also solves', () => {
    const ois: SwapConfig = {
      type: 'OIS',
      legs: [
        { ...fixedLeg, schedule: { ...schedule, frequency: 'Annual' as const } },
        { ...floatLeg, schedule: { ...schedule, frequency: 'Annual' as const } },
      ],
      tradeDate: irs.tradeDate,
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const solved = solveParRate(ois, ctx)
    const at: SwapConfig = {
      ...ois,
      legs: [{ ...(ois.legs[0] as FixedLegConfig), rate: solved }, ois.legs[1]],
    }
    const { npv } = pricingEngine.price(at, ctx)
    expect(Math.abs(npv)).toBeLessThan(1e-8 * Math.abs(fixedLeg.notional))
  })

  test('Newton fallback: fixed-leg rate starts at 0 (zero-annuity path)', () => {
    // When fixed leg starts at rate=0, engine.parRate divides by an annuity
    // it couldn't compute (annuity = pv/rate → NaN). Make sure fallback
    // lands a sensible answer.
    const zeroRateIrs: SwapConfig = { ...irs, legs: [{ ...fixedLeg, rate: 0 }, floatLeg] }
    const solved = solveParRate(zeroRateIrs, ctx)
    const at: SwapConfig = { ...zeroRateIrs, legs: [{ ...fixedLeg, rate: solved }, floatLeg] }
    const { npv } = pricingEngine.price(at, ctx)
    expect(Math.abs(npv)).toBeLessThan(1e-8 * Math.abs(fixedLeg.notional))
  })
})
