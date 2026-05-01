import { describe, expect, test } from 'vitest'
import { pricingEngine } from '../../engine/price.js'
import type {
  CurveBook,
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  SwapConfig,
} from '../../engine/types.js'
import { basisDv01, keyRateDv01 } from '../../risk/metrics.js'
import { solveHedgeNotional } from '../hedge-notional.js'

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
const target: SwapConfig = {
  type: 'IRS',
  legs: [fixedLeg, floatLeg],
  tradeDate: new Date(2026, 3, 10),
  effectiveDate: schedule.startDate,
  maturityDate: schedule.endDate,
}
// Hedge is a smaller-notional, longer-tenor IRS so DV01-per-unit-notional differs from target.
const hedgeSchedule = {
  startDate: new Date(2026, 3, 15),
  endDate: new Date(2029, 3, 15),
  frequency: 'Quarterly' as const,
}
const hedge: SwapConfig = {
  ...target,
  legs: [
    { ...fixedLeg, notional: 10e6, schedule: hedgeSchedule },
    { ...floatLeg, notional: -10e6, schedule: hedgeSchedule },
  ],
  effectiveDate: hedgeSchedule.startDate,
  maturityDate: hedgeSchedule.endDate,
}
const ctx: PricingContext = { curve, index: sofr, observations: [] }

function scaleNotionals(config: SwapConfig, factor: number): SwapConfig {
  return {
    ...config,
    legs: config.legs.map((l) => {
      if (l.legType === 'fixed') return { ...l, notional: l.notional * factor }
      if (l.legType === 'float') return { ...l, notional: l.notional * factor }
      return l
    }),
  }
}

// Signed parallel DV01 (per the measure() helper inside the solver):
// (NPV(+1bp) − NPV(−1bp)) / 2
function signedDv01(config: SwapConfig, c: PricingContext): number {
  const BP = 0.0001
  const up = pricingEngine.price(config, {
    ...c,
    curve: {
      ...c.curve,
      pillars: c.curve.pillars.map((p) => ({ ...p, zeroRate: p.zeroRate + BP })),
    },
  }).npv
  const down = pricingEngine.price(config, {
    ...c,
    curve: {
      ...c.curve,
      pillars: c.curve.pillars.map((p) => ({ ...p, zeroRate: p.zeroRate - BP })),
    },
  }).npv
  return (up - down) / 2
}

describe('solveHedgeNotional — dv01', () => {
  test('combined signed DV01 ≈ 0 within 1e-6·|target DV01|', () => {
    const hedgeNotional = solveHedgeNotional(target, ctx, hedge, ctx, 'dv01')
    const factor = hedgeNotional / (hedge.legs[0] as FixedLegConfig).notional
    const scaled = scaleNotionals(hedge, factor)
    const combined = signedDv01(target, ctx) + signedDv01(scaled, ctx)
    const targetDv01 = Math.abs(signedDv01(target, ctx))
    expect(Math.abs(combined)).toBeLessThan(1e-6 * targetDv01)
  })

  test('sign of hedge notional is opposite the target (same-sign fixed legs)', () => {
    const hedgeNotional = solveHedgeNotional(target, ctx, hedge, ctx, 'dv01')
    expect(Math.sign(hedgeNotional)).toBe(-Math.sign((target.legs[0] as FixedLegConfig).notional))
  })

  test('throws when hedge has zero measure', () => {
    // Degenerate hedge: both legs at zero notional → zero DV01.
    const zeroHedge: SwapConfig = {
      ...hedge,
      legs: [
        { ...(hedge.legs[0] as FixedLegConfig), notional: 0 },
        { ...(hedge.legs[1] as FloatLegConfig), notional: 0 },
      ],
    }
    expect(() => solveHedgeNotional(target, ctx, zeroHedge, ctx, 'dv01')).toThrow()
  })
})

describe('solveHedgeNotional — basisDv01', () => {
  const book: CurveBook = {
    asOf: '2026-04-10T00:00:00Z',
    byCurrency: {
      USD: {
        discount: curve,
        projections: {
          'USD-SOFR': { ...curve, curveType: 'Projection' },
          'USD-FedFunds': { ...curve, curveType: 'Projection' },
        },
      },
    },
  }
  const fedFunds: FloatingRateIndex = { ...sofr, indexId: 'USD-FedFunds' }
  const legA: FloatLegConfig = { ...floatLeg, notional: 50e6 }
  const legB: FloatLegConfig = { ...floatLeg, notional: -50e6, indexId: 'FedFunds', spread: 0.001 }
  const basisTarget: SwapConfig = { ...target, type: 'BASIS', legs: [legA, legB] }
  const hedgeBasis: SwapConfig = {
    ...basisTarget,
    legs: [
      { ...legA, notional: 10e6, schedule: hedgeSchedule },
      { ...legB, notional: -10e6, schedule: hedgeSchedule },
    ],
    effectiveDate: hedgeSchedule.startDate,
    maturityDate: hedgeSchedule.endDate,
  }
  const bctx: PricingContext = {
    curve,
    index: sofr,
    indicesByLeg: [sofr, fedFunds],
    observations: [],
    book,
  }

  test('combined basis DV01 ≈ 0 within 1e-6·|target basis DV01|', () => {
    const hedgeNotional = solveHedgeNotional(basisTarget, bctx, hedgeBasis, bctx, 'basisDv01')
    const factor = hedgeNotional / (hedgeBasis.legs[0] as FloatLegConfig).notional
    const scaled = scaleNotionals(hedgeBasis, factor)
    const combined = basisDv01(basisTarget, bctx) + basisDv01(scaled, bctx)
    const mag = Math.abs(basisDv01(basisTarget, bctx))
    expect(Math.abs(combined)).toBeLessThan(1e-6 * mag)
  })
})

describe('solveHedgeNotional — keyRate', () => {
  test('combined KRD(365) ≈ 0 within 1e-6·|target KRD|', () => {
    const hedgeNotional = solveHedgeNotional(target, ctx, hedge, ctx, 'keyRate', 365)
    const factor = hedgeNotional / (hedge.legs[0] as FixedLegConfig).notional
    const scaled = scaleNotionals(hedge, factor)
    const pick = (cfg: SwapConfig) =>
      keyRateDv01(cfg, ctx).find((e) => e.pillarTenorDays === 365)!.dv01
    const combined = pick(target) + pick(scaled)
    expect(Math.abs(combined)).toBeLessThan(1e-6 * Math.abs(pick(target)))
  })

  test('throws when keyRate is selected without pillarTenorDays', () => {
    expect(() => solveHedgeNotional(target, ctx, hedge, ctx, 'keyRate')).toThrow()
  })

  test('throws when pillarTenorDays does not match any pillar', () => {
    expect(() => solveHedgeNotional(target, ctx, hedge, ctx, 'keyRate', 9999)).toThrow()
  })
})
