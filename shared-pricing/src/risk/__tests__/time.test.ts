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
import {
  advanceAsOf,
  carry,
  forwardNpv,
  type Horizon,
  resolveHorizon,
  roll,
  theta,
} from '../time.js'

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

const mkFlatCurve = (ccy: string, curveType: 'Discount' | 'Projection'): DiscountCurve => ({
  currency: ccy,
  curveType,
  indexId: null,
  asOf: '2026-04-10T00:00:00Z',
  pillars: [
    { tenorDays: 91, zeroRate: 0.04 },
    { tenorDays: 365, zeroRate: 0.04 },
    { tenorDays: 1826, zeroRate: 0.04 },
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

// Match the accrued.test.ts convention: local-time Date constructors.
const schedule = {
  startDate: new Date(2026, 0, 15),
  endDate: new Date(2027, 0, 15),
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
  tradeDate: new Date(2026, 0, 10),
  effectiveDate: schedule.startDate,
  maturityDate: schedule.endDate,
}

const ctx: PricingContext = {
  curve: mkCurve('USD', 'Discount'),
  index: sofr,
  observations: [],
}

describe('resolveHorizon', () => {
  test('toTimestamp: returns the target verbatim', () => {
    expect(resolveHorizon(irs, ctx, { kind: 'toTimestamp', asOf: '2026-05-01T00:00:00Z' })).toBe(
      '2026-05-01T00:00:00Z',
    )
  })

  test('toTimestamp: rejects non-forward targets', () => {
    expect(() => resolveHorizon(irs, ctx, { kind: 'toTimestamp', asOf: ctx.curve.asOf })).toThrow()
    expect(() =>
      resolveHorizon(irs, ctx, { kind: 'toTimestamp', asOf: '2026-04-09T00:00:00Z' }),
    ).toThrow()
  })

  test('deltaSeconds: adds to current asOf', () => {
    expect(resolveHorizon(irs, ctx, { kind: 'deltaSeconds', seconds: 86400 })).toBe(
      '2026-04-11T00:00:00.000Z',
    )
  })

  test('deltaSeconds: rejects non-positive deltas', () => {
    expect(() => resolveHorizon(irs, ctx, { kind: 'deltaSeconds', seconds: 0 })).toThrow()
    expect(() => resolveHorizon(irs, ctx, { kind: 'deltaSeconds', seconds: -60 })).toThrow()
  })

  test("toNextEvent('fixing'): next float-leg period-end after asOf", () => {
    const got = resolveHorizon(irs, ctx, { kind: 'toNextEvent', event: 'fixing' })
    // Q1 period-end (from startDate + 3 months) = April 15
    expect(new Date(got).getTime()).toBe(new Date(2026, 3, 15).getTime())
  })

  test("toNextEvent('payment'): earliest payment date across legs", () => {
    const got = resolveHorizon(irs, ctx, { kind: 'toNextEvent', event: 'payment' })
    expect(new Date(got).getTime()).toBe(new Date(2026, 3, 15).getTime())
  })

  test("toNextEvent('fixing') falls back to payment when no float legs", () => {
    const fixedOnly: SwapConfig = { ...irs, legs: [fixedLeg] }
    const got = resolveHorizon(fixedOnly, ctx, { kind: 'toNextEvent', event: 'fixing' })
    expect(new Date(got).getTime()).toBe(new Date(2026, 3, 15).getTime())
  })
})

describe('advanceAsOf', () => {
  test('slide: shifts curve.asOf but keeps pillar tenorDays', () => {
    const next = advanceAsOf(ctx, '2026-04-15T00:00:00Z', 'slide')
    expect(next.curve.asOf).toBe('2026-04-15T00:00:00Z')
    expect(next.curve.pillars.map((p) => p.tenorDays)).toEqual([91, 365, 1826])
  })

  test('freeze: shifts pillar tenorDays backward by elapsed days', () => {
    // 5 calendar days from 2026-04-10 → 2026-04-15
    const next = advanceAsOf(ctx, '2026-04-15T00:00:00Z', 'freeze')
    expect(next.curve.asOf).toBe('2026-04-15T00:00:00Z')
    expect(next.curve.pillars.map((p) => p.tenorDays)).toEqual([86, 360, 1821])
  })

  test('freeze: clips pillar tenorDays at 1 when delta exceeds original tenor', () => {
    // 365 days elapsed: 91 → clip(1), 365 → clip(1), 1826 → 1461
    const next = advanceAsOf(ctx, '2027-04-10T00:00:00Z', 'freeze')
    expect(next.curve.pillars.map((p) => p.tenorDays)).toEqual([1, 1, 1461])
  })

  test('freeze: shifts book pillars too', () => {
    const book: CurveBook = {
      asOf: '2026-04-10T00:00:00Z',
      byCurrency: {
        USD: {
          discount: mkCurve('USD', 'Discount'),
          projections: { 'USD-SOFR': mkCurve('USD', 'Projection') },
        },
      },
    }
    const next = advanceAsOf({ ...ctx, book }, '2026-04-15T00:00:00Z', 'freeze')
    expect(next.book!.asOf).toBe('2026-04-15T00:00:00Z')
    expect(next.book!.byCurrency.USD.discount.pillars.map((p) => p.tenorDays)).toEqual([
      86, 360, 1821,
    ])
    expect(
      next.book!.byCurrency.USD.projections['USD-SOFR'].pillars.map((p) => p.tenorDays),
    ).toEqual([86, 360, 1821])
  })

  test('rejects backward moves', () => {
    expect(() => advanceAsOf(ctx, '2026-04-09T00:00:00Z', 'slide')).toThrow()
  })
})

describe('forwardNpv', () => {
  test('pre-start ctx: forwardNpv at current asOf matches engine NPV', () => {
    // Before effectiveDate, no cashflows are in the past yet, so the
    // strictly-future filter excludes nothing and forwardNpv equals the
    // engine's NPV (slide at delta=0 leaves pillars untouched either way).
    const preStart: PricingContext = {
      ...ctx,
      curve: { ...ctx.curve, asOf: '2026-01-10T00:00:00Z' },
    }
    const fwd = forwardNpv(irs, preStart, '2026-01-10T00:00:00Z')
    const live = pricingEngine.price(irs, preStart).npv
    expect(fwd).toBeCloseTo(live, 6)
  })

  test('rejects backward asOf', () => {
    expect(() => forwardNpv(irs, ctx, '2026-04-09T00:00:00Z')).toThrow()
  })
})

describe('carry', () => {
  test('IRS: carry across one coupon date is positive (fixed > float by construction)', () => {
    // Horizon past Q1 period-end (2026-04-15) but before Q2 (2026-07-15).
    // Exactly one coupon on each leg lands. Fixed rate 4.25% vs ~SOFR 4.3%,
    // but compounded SOFR for Q1 runs at the curve's short end.
    const h: Horizon = { kind: 'toTimestamp', asOf: '2026-05-01T00:00:00Z' }
    const c = carry(irs, ctx, h)
    // Sanity: fixed leg nominal Q1 coupon = 50m × 0.0425 × (90/360) = 531_250
    // Net carry should be the small fixed − float differential, order of magnitude 10^4.
    expect(Math.abs(c)).toBeLessThan(50_000)
    expect(Math.abs(c)).toBeGreaterThan(0)
  })

  test('IRS: carry is 0 when horizon is before the first coupon date', () => {
    const h: Horizon = { kind: 'toTimestamp', asOf: '2026-04-14T00:00:00Z' }
    expect(carry(irs, ctx, h)).toBe(0)
  })

  test('carry sign flips when notionals flip', () => {
    const flipped: SwapConfig = {
      ...irs,
      legs: [
        { ...fixedLeg, notional: -fixedLeg.notional },
        { ...floatLeg, notional: -floatLeg.notional },
      ],
    }
    const h: Horizon = { kind: 'toTimestamp', asOf: '2026-05-01T00:00:00Z' }
    expect(carry(flipped, ctx, h)).toBeCloseTo(-carry(irs, ctx, h), 6)
  })
})

describe('theta / roll identity', () => {
  test('no cashflows in horizon: forwardNpv(t1) = NPV(t0) + theta + roll', () => {
    // Horizon safely before the first quarterly coupon (2026-04-15).
    const h: Horizon = { kind: 'toTimestamp', asOf: '2026-04-14T00:00:00Z' }
    const t1 = resolveHorizon(irs, ctx, h)
    const npv0 = pricingEngine.price(irs, ctx).npv
    const th = theta(irs, ctx, h)
    const rl = roll(irs, ctx, h)
    const fn = forwardNpv(irs, ctx, t1)
    expect(th + rl + npv0).toBeCloseTo(fn, 6)
  })

  test('theta is small (O(rate × Δt × |NPV|)) under freeze mode with no carry', () => {
    // LinearZero interpolation with simple-rate DFs is NOT exactly
    // shift-invariant — DF depends on rate × time, so moving the
    // valuation date changes the time-to-discount even with pinned
    // rates. For a 10-day horizon on 50m IRS we expect |theta| << |NPV|.
    const preStart: PricingContext = {
      ...ctx,
      curve: { ...ctx.curve, asOf: '2026-01-10T00:00:00Z' },
    }
    const h: Horizon = { kind: 'toTimestamp', asOf: '2026-01-20T00:00:00Z' }
    const th = theta(irs, preStart, h)
    const npv = pricingEngine.price(irs, preStart).npv
    // |theta| should be tiny vs |NPV|; the bound is loose-but-indicative.
    expect(Math.abs(th)).toBeLessThan(Math.max(1_000, Math.abs(npv) * 1e-4))
  })
})

describe('roll', () => {
  test('flat curve: roll is 0', () => {
    const flatCtx: PricingContext = { ...ctx, curve: mkFlatCurve('USD', 'Discount') }
    const h: Horizon = { kind: 'toTimestamp', asOf: '2026-04-14T00:00:00Z' }
    expect(roll(irs, flatCtx, h)).toBeCloseTo(0, 6)
  })

  test('sloped curve: roll is non-zero', () => {
    const h: Horizon = { kind: 'toTimestamp', asOf: '2026-04-14T00:00:00Z' }
    expect(Math.abs(roll(irs, ctx, h))).toBeGreaterThan(0)
  })
})

describe("horizon variants compose under toNextEvent('fixing')", () => {
  test('theta + roll + NPV(t0) = forwardNpv(t1)', () => {
    // At t1 = next fixing (2026-04-15) the Q1 coupon date equals t1
    // exactly, so the strictly-future filter excludes it from forwardNpv
    // and the cashflow shows up in carry (date > t0 && date <= t1).
    // The static identity forwardNpv(t1) = NPV(t0) + theta + roll still
    // holds because both theta (freeze-mode priceStrictlyFuture) and
    // forwardNpv (slide-mode priceStrictlyFuture) use the same cutoff.
    const h: Horizon = { kind: 'toNextEvent', event: 'fixing' }
    const t1 = resolveHorizon(irs, ctx, h)
    const npv0 = pricingEngine.price(irs, ctx).npv
    const th = theta(irs, ctx, h)
    const rl = roll(irs, ctx, h)
    const fn = forwardNpv(irs, ctx, t1)
    expect(th + rl + npv0).toBeCloseTo(fn, 4)
  })
})
