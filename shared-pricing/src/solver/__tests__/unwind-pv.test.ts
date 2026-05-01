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
import { solveUnwindPv } from '../unwind-pv.js'

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

describe('solveUnwindPv', () => {
  test('equals pricingEngine.price(config, ctx).npv exactly', () => {
    const direct = pricingEngine.price(irs, ctx).npv
    expect(solveUnwindPv(irs, ctx)).toBe(direct)
  })
})
