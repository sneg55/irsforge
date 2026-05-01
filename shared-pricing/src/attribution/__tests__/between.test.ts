// shared-pricing/src/attribution/__tests__/between.test.ts
import { describe, expect, test } from 'vitest'
import type {
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  SwapConfig,
} from '../../engine/types.js'
import { between } from '../between.js'
import { decompose, type PricingSnapshot } from '../decompose.js'

const makeCurve = (asOf: string, bump = 0): DiscountCurve => ({
  currency: 'USD',
  curveType: 'Discount',
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
const cfg: SwapConfig = {
  type: 'IRS',
  legs: [fixedLeg, floatLeg],
  tradeDate: new Date('2026-04-10T00:00:00Z'),
  effectiveDate: schedule.startDate,
  maturityDate: schedule.endDate,
}

const snap = (asOf: string, bump = 0): PricingSnapshot => ({
  asOf,
  curve: makeCurve(asOf, bump),
  index: sofr,
})

describe('between', () => {
  test('additivity: total(t0,t2) == total(t0,t1) + total(t1,t2) within 1e-6', () => {
    const s0 = snap('2026-04-15T00:00:00Z', 0.0)
    const s1 = snap('2026-04-16T00:00:00Z', 0.0005)
    const s2 = snap('2026-04-17T00:00:00Z', 0.001)
    const snaps = [s0, s1, s2]
    const full = between(cfg, snaps, [], s0.asOf, s2.asOf)
    const left = between(cfg, snaps, [], s0.asOf, s1.asOf)
    const right = between(cfg, snaps, [], s1.asOf, s2.asOf)
    expect(full.total).toBeCloseTo(left.total + right.total, 6)
  })

  test('delegates to decompose(snap0, snap1)', () => {
    const s0 = snap('2026-04-15T00:00:00Z', 0.0)
    const s1 = snap('2026-04-16T00:00:00Z', 0.0005)
    const direct = decompose(cfg, s0, s1, [])
    const via = between(cfg, [s0, s1], [], s0.asOf, s1.asOf)
    expect(via.total).toBe(direct.total)
    expect(via.curve).toBe(direct.curve)
    expect(via.unexplained).toBe(direct.unexplained)
  })

  test('throws when t0 snapshot is missing', () => {
    const s1 = snap('2026-04-16T00:00:00Z')
    expect(() => between(cfg, [s1], [], '2026-04-15T00:00:00Z', s1.asOf)).toThrow(/t0/)
  })

  test('throws when t1 snapshot is missing', () => {
    const s0 = snap('2026-04-15T00:00:00Z')
    expect(() => between(cfg, [s0], [], s0.asOf, '2026-04-16T00:00:00Z')).toThrow(/t1/)
  })

  test('filters events to (t0, t1]', () => {
    const s0 = snap('2026-04-15T00:00:00Z')
    const s1 = snap('2026-04-16T00:00:00Z')
    const windowed = between(
      cfg,
      [s0, s1],
      [
        { kind: 'cashflow', currency: 'USD', date: '2026-04-14T00:00:00Z', amount: 99 },
        { kind: 'cashflow', currency: 'USD', date: '2026-04-16T00:00:00Z', amount: 100 },
      ],
      s0.asOf,
      s1.asOf,
    )
    const direct = decompose(cfg, s0, s1, [
      { kind: 'cashflow', currency: 'USD', date: '2026-04-16T00:00:00Z', amount: 100 },
    ])
    expect(windowed.total).toBeCloseTo(direct.total, 6)
  })
})
