// shared-pricing/src/attribution/__tests__/decompose.test.ts
import { describe, expect, test } from 'vitest'
import type {
  CurveBook,
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  SwapConfig,
} from '../../engine/types.js'
import { decompose, type LedgerEvent, type PricingSnapshot } from '../decompose.js'

const makeCurve = (
  asOf: string,
  curveType: 'Discount' | 'Projection',
  bump = 0,
): DiscountCurve => ({
  currency: 'USD',
  curveType,
  indexId: null,
  asOf,
  pillars: [
    { tenorDays: 91, zeroRate: 0.0431 + bump },
    { tenorDays: 365, zeroRate: 0.0415 + bump },
    { tenorDays: 1826, zeroRate: 0.0387 + bump },
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
  startDate: new Date('2026-04-15T00:00:00Z'),
  endDate: new Date('2027-04-15T00:00:00Z'),
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
  indexId: 'USD-SOFR',
  spread: 0,
  dayCount: 'ACT_360',
  schedule,
}
const irs: SwapConfig = {
  type: 'IRS',
  legs: [fixedLeg, floatLeg],
  tradeDate: new Date('2026-04-10T00:00:00Z'),
  effectiveDate: schedule.startDate,
  maturityDate: schedule.endDate,
}

describe('decompose — identity', () => {
  test('same snapshot, no events → every bucket is 0', () => {
    const snap: PricingSnapshot = {
      asOf: '2026-04-15T00:00:00Z',
      curve: makeCurve('2026-04-15T00:00:00Z', 'Discount'),
      index: sofr,
    }
    const r = decompose(irs, snap, snap, [])
    expect(r.total).toBe(0)
    expect(r.curve).toBe(0)
    expect(r.basis).toBe(0)
    expect(r.carry).toBe(0)
    expect(r.roll).toBe(0)
    expect(r.fixing).toBe(0)
    expect(r.unexplained).toBe(0)
  })
})

describe('decompose — pure curve shift', () => {
  test('only discount curve moves: curve ≠ 0; every other bucket ≈ 0', () => {
    const snap0: PricingSnapshot = {
      asOf: '2026-04-15T00:00:00Z',
      curve: makeCurve('2026-04-15T00:00:00Z', 'Discount', 0),
      index: sofr,
    }
    const snap1: PricingSnapshot = {
      asOf: '2026-04-15T00:00:00Z',
      curve: makeCurve('2026-04-15T00:00:00Z', 'Discount', +0.001),
      index: sofr,
    }
    const r = decompose(irs, snap0, snap1, [])
    expect(Math.abs(r.curve)).toBeGreaterThan(1)
    expect(Math.abs(r.basis)).toBeLessThan(1e-6)
    expect(Math.abs(r.carry)).toBeLessThan(1e-6)
    expect(Math.abs(r.roll)).toBeLessThan(1e-6)
    expect(Math.abs(r.fixing)).toBeLessThan(1e-6)
    expect(Math.abs(r.unexplained)).toBeLessThan(1e-6)
    expect(r.total).toBeCloseTo(r.curve, 6)
  })
})

describe('decompose — pure basis shift (BASIS swap)', () => {
  test('only projection curve moves: basis ≠ 0; curve ≈ 0', () => {
    // Same-sign notionals (both +50M) mirror the Stage B basis-dv01 convention
    // (`basis-dv01.test.ts:63-67`): in the single-projection-per-currency
    // model, opposite-sign notionals cancel under a uniform projection bump.
    // Same-sign keeps the basis bucket observable at full magnitude.
    const fedFunds: FloatingRateIndex = { ...sofr, indexId: 'USD-FedFunds' }
    const legA: FloatLegConfig = { ...floatLeg, notional: 50e6, indexId: 'USD-SOFR' }
    const legB: FloatLegConfig = {
      ...floatLeg,
      notional: 50e6,
      indexId: 'USD-FedFunds',
      spread: 0.001,
    }
    const basisCfg: SwapConfig = { ...irs, type: 'BASIS', legs: [legA, legB] }

    const bookT0: CurveBook = {
      asOf: '2026-04-15T00:00:00Z',
      byCurrency: {
        USD: {
          discount: makeCurve('2026-04-15T00:00:00Z', 'Discount', 0),
          projections: {
            'USD-SOFR': makeCurve('2026-04-15T00:00:00Z', 'Projection', 0),
            'USD-FedFunds': makeCurve('2026-04-15T00:00:00Z', 'Projection', 0),
          },
        },
      },
    }
    const bookT1: CurveBook = {
      asOf: '2026-04-15T00:00:00Z',
      byCurrency: {
        USD: {
          discount: makeCurve('2026-04-15T00:00:00Z', 'Discount', 0),
          projections: {
            'USD-SOFR': makeCurve('2026-04-15T00:00:00Z', 'Projection', +0.001),
            'USD-FedFunds': makeCurve('2026-04-15T00:00:00Z', 'Projection', +0.001),
          },
        },
      },
    }

    const snap0: PricingSnapshot = {
      asOf: '2026-04-15T00:00:00Z',
      curve: bookT0.byCurrency.USD.discount,
      book: bookT0,
      index: sofr,
      indicesByLeg: [sofr, fedFunds],
    }
    const snap1: PricingSnapshot = {
      asOf: '2026-04-15T00:00:00Z',
      curve: bookT1.byCurrency.USD.discount,
      book: bookT1,
      index: sofr,
      indicesByLeg: [sofr, fedFunds],
    }
    const r = decompose(basisCfg, snap0, snap1, [])
    expect(Math.abs(r.basis)).toBeGreaterThan(1)
    expect(Math.abs(r.curve)).toBeLessThan(1e-6)
    expect(Math.abs(r.carry)).toBeLessThan(1e-6)
    expect(Math.abs(r.roll)).toBeLessThan(1e-6)
    expect(Math.abs(r.unexplained)).toBeLessThan(1e-6)
  })
})

describe('decompose — time only (carry + roll)', () => {
  test('only asOf advances: carry + roll != 0; curve/basis/fixing ≈ 0', () => {
    const snap0: PricingSnapshot = {
      asOf: '2026-04-15T00:00:00Z',
      curve: makeCurve('2026-04-15T00:00:00Z', 'Discount'),
      index: sofr,
    }
    const snap1: PricingSnapshot = {
      asOf: '2026-04-16T00:00:00Z',
      curve: makeCurve('2026-04-16T00:00:00Z', 'Discount'),
      index: sofr,
    }
    const r = decompose(irs, snap0, snap1, [])
    expect(Math.abs(r.basis)).toBeLessThan(1e-6)
    expect(Math.abs(r.curve)).toBeLessThan(1e-6)
    expect(Math.abs(r.fixing)).toBeLessThan(1e-6)
    expect(Math.abs(r.carry + r.roll)).toBeGreaterThan(0)
    expect(Math.abs(r.unexplained)).toBeLessThan(1e-6)
  })
})

describe('decompose — invariant |unexplained| / |total| <= 1bp (1e-4)', () => {
  test('combined curve + time + basis: residual stays under 1bp of total', () => {
    const snap0: PricingSnapshot = {
      asOf: '2026-04-15T00:00:00Z',
      curve: makeCurve('2026-04-15T00:00:00Z', 'Discount', 0),
      index: sofr,
    }
    const snap1: PricingSnapshot = {
      asOf: '2026-04-16T00:00:00Z',
      curve: makeCurve('2026-04-16T00:00:00Z', 'Discount', +0.0005),
      index: sofr,
    }
    const r = decompose(irs, snap0, snap1, [])
    const denom = Math.max(Math.abs(r.total), 1)
    expect(Math.abs(r.unexplained) / denom).toBeLessThan(1e-4)
    const sum = r.curve + r.basis + r.carry + r.roll + r.fixing + r.unexplained
    expect(Math.abs(sum - r.total)).toBeLessThan(1e-8 * denom)
  })
})

describe('decompose — cashflow events subtracted from total', () => {
  test('paid cashflow in (t0, t1] is excluded from total', () => {
    const snap0: PricingSnapshot = {
      asOf: '2026-04-15T00:00:00Z',
      curve: makeCurve('2026-04-15T00:00:00Z', 'Discount'),
      index: sofr,
    }
    const snap1: PricingSnapshot = {
      asOf: '2026-04-16T00:00:00Z',
      curve: makeCurve('2026-04-16T00:00:00Z', 'Discount'),
      index: sofr,
    }
    const events: LedgerEvent[] = [
      { kind: 'cashflow', currency: 'USD', date: '2026-04-15T12:00:00Z', amount: 100_000 },
    ]
    const withEvent = decompose(irs, snap0, snap1, events)
    const withoutEvent = decompose(irs, snap0, snap1, [])
    expect(withEvent.total).toBeCloseTo(withoutEvent.total - 100_000, 6)
  })
})
