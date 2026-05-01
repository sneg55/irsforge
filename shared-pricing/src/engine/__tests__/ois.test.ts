import { describe, expect, test } from 'vitest'
import { pricingEngine } from '../price.js'
import type {
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  SwapConfig,
} from '../types.js'

// Flat 4% curve — when fixedRate also = 4%, the fixed-vs-compounded-float
// swap is at par and NPV should be ≈ 0. Any larger than ~10bp of
// notional implies the OIS leg pricing drifted from IRS.
const flatCurve: DiscountCurve = {
  currency: 'USD',
  curveType: 'Discount',
  indexId: null,
  asOf: '2026-04-16T00:00:00Z',
  pillars: [
    { tenorDays: 1, zeroRate: 0.04 },
    { tenorDays: 365, zeroRate: 0.04 },
    { tenorDays: 1826, zeroRate: 0.04 },
  ],
  interpolation: 'LinearZero',
  dayCount: 'Act360',
}

const sofrIndex: FloatingRateIndex = {
  indexId: 'USD-SOFR',
  currency: 'USD',
  family: 'SOFR',
  compounding: 'CompoundedInArrears',
  lookback: 0,
  floor: 0.0,
}

const schedule = {
  startDate: new Date(2026, 3, 16),
  endDate: new Date(2031, 3, 16),
  frequency: 'Annual' as const,
}

const notional = 50_000_000

const fixedLeg: FixedLegConfig = {
  legType: 'fixed',
  currency: 'USD',
  notional,
  rate: 0.04,
  dayCount: 'ACT_360',
  schedule,
}
const floatLeg: FloatLegConfig = {
  legType: 'float',
  currency: 'USD',
  notional,
  indexId: 'USD-SOFR',
  spread: 0,
  dayCount: 'ACT_360',
  schedule,
}

describe('OIS pricing', () => {
  test('routes OIS through the IRS strategy — engine has a registered strategy', () => {
    const cfg: SwapConfig = {
      type: 'OIS',
      legs: [fixedLeg, floatLeg],
      tradeDate: new Date(2026, 3, 16),
      effectiveDate: new Date(2026, 3, 16),
      maturityDate: new Date(2031, 3, 16),
    }
    const ctx: PricingContext = { curve: flatCurve, index: sofrIndex, observations: [] }
    const result = pricingEngine.price(cfg, ctx)
    // NPV is a finite number (not NaN / undefined) — proves the engine
    // didn't blow up on the 'OIS' dispatch.
    expect(Number.isFinite(result.npv)).toBe(true)
    expect(result.legPVs.length).toBe(2)
  })

  test('at par (flat 4% curve, 4% fixed) the two legs balance to ≤ 10 bp of notional', () => {
    // The engine does not carry pay/receive direction on legs; both
    // `legPVs` are positive annuities. "At par" translates to the fixed
    // annuity matching the float annuity — the NPV that a direction-aware
    // pricer would zero is approximated by the absolute gap here.
    const cfg: SwapConfig = {
      type: 'OIS',
      legs: [fixedLeg, floatLeg],
      tradeDate: new Date(2026, 3, 16),
      effectiveDate: new Date(2026, 3, 16),
      maturityDate: new Date(2031, 3, 16),
    }
    const ctx: PricingContext = { curve: flatCurve, index: sofrIndex, observations: [] }
    const result = pricingEngine.price(cfg, ctx)
    const [pvFixed, pvFloat] = result.legPVs
    const gap = Math.abs(pvFixed - pvFloat) / notional
    // Each leg should be ~17% of notional (5Y annuity @4%); tolerance
    // below 10 bp confirms IRS and OIS dispatch reach the same numbers.
    expect(pvFixed).toBeGreaterThan(0)
    expect(pvFloat).toBeGreaterThan(0)
    expect(gap).toBeLessThan(0.001)
  })

  test('OIS and IRS dispatch produce identical leg PVs for the same config shape', () => {
    const ois: SwapConfig = {
      type: 'OIS',
      legs: [fixedLeg, floatLeg],
      tradeDate: new Date(2026, 3, 16),
      effectiveDate: new Date(2026, 3, 16),
      maturityDate: new Date(2031, 3, 16),
    }
    const irs: SwapConfig = { ...ois, type: 'IRS' }
    const ctx: PricingContext = { curve: flatCurve, index: sofrIndex, observations: [] }
    const oisRes = pricingEngine.price(ois, ctx)
    const irsRes = pricingEngine.price(irs, ctx)
    expect(oisRes.legPVs[0]).toBeCloseTo(irsRes.legPVs[0], 6)
    expect(oisRes.legPVs[1]).toBeCloseTo(irsRes.legPVs[1], 6)
  })
})
