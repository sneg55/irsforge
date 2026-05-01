import { describe, expect, test } from 'vitest'
import { DEFAULT_CREDIT_SPREAD } from '../../engine/defaults.js'
import type { CurveBook, DiscountCurve, PricingContext } from '../../engine/types.js'
import { bumpCreditSpread, bumpFxSpot, bumpParallel, bumpPillar } from '../bump.js'

const makeCurve = (ccy: string, curveType: 'Discount' | 'Projection'): DiscountCurve => ({
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

const ctxSingle: PricingContext = {
  curve: makeCurve('USD', 'Discount'),
  index: null,
  observations: [],
}

const book: CurveBook = {
  asOf: '2026-04-10T00:00:00Z',
  byCurrency: {
    USD: {
      discount: makeCurve('USD', 'Discount'),
      projections: { 'USD-SOFR': makeCurve('USD', 'Projection') },
    },
    EUR: {
      discount: makeCurve('EUR', 'Discount'),
      projections: { 'EUR-ESTR': makeCurve('EUR', 'Projection') },
    },
  },
}

const ctxMulti: PricingContext = {
  curve: makeCurve('USD', 'Discount'),
  index: null,
  observations: [],
  book,
  fxSpots: { EURUSD: 1.1 },
}

describe('bumpParallel', () => {
  test('shifts every pillar of ctx.curve by bp', () => {
    const out = bumpParallel(ctxSingle, 0.0001)
    const rates = out.curve.pillars.map((p) => p.zeroRate)
    expect(rates[0]).toBeCloseTo(0.0432, 12)
    expect(rates[1]).toBeCloseTo(0.0416, 12)
    expect(rates[2]).toBeCloseTo(0.0388, 12)
  })

  test('does not mutate input', () => {
    const before = ctxSingle.curve.pillars[0].zeroRate
    bumpParallel(ctxSingle, 0.0001)
    expect(ctxSingle.curve.pillars[0].zeroRate).toBe(before)
  })

  test('shifts every book pillar when book is present', () => {
    const out = bumpParallel(ctxMulti, 0.0001)
    expect(out.book!.byCurrency.USD.discount.pillars[0].zeroRate).toBeCloseTo(0.0432, 12)
    expect(out.book!.byCurrency.USD.projections['USD-SOFR'].pillars[0].zeroRate).toBeCloseTo(
      0.0432,
      12,
    )
    expect(out.book!.byCurrency.EUR.discount.pillars[1].zeroRate).toBeCloseTo(0.0416, 12)
  })
})

describe('bumpPillar', () => {
  test('shifts only the selected pillar on ctx.curve (single-ccy path)', () => {
    const out = bumpPillar(
      ctxSingle,
      { currency: 'USD', curveType: 'Discount', tenorDays: 365 },
      0.0001,
    )
    expect(out.curve.pillars[0].zeroRate).toBe(0.0431)
    expect(out.curve.pillars[1].zeroRate).toBeCloseTo(0.0416, 12)
    expect(out.curve.pillars[2].zeroRate).toBe(0.0387)
  })

  test('shifts only the selected (currency, curveType, tenor) pillar on book', () => {
    // Without indexId: bumps ALL projections for EUR (legacy path).
    const out = bumpPillar(
      ctxMulti,
      { currency: 'EUR', curveType: 'Projection', tenorDays: 1826 },
      0.0001,
    )
    expect(out.book!.byCurrency.EUR.projections['EUR-ESTR'].pillars[2].zeroRate).toBeCloseTo(
      0.0388,
      12,
    )
    expect(out.book!.byCurrency.EUR.discount.pillars[2].zeroRate).toBe(0.0387)
    expect(out.book!.byCurrency.USD.projections['USD-SOFR'].pillars[2].zeroRate).toBe(0.0387)
    expect(out.book!.byCurrency.EUR.projections['EUR-ESTR'].pillars[0].zeroRate).toBe(0.0431)
  })

  test('unknown currency is a fatal error (no silent fallback)', () => {
    expect(() =>
      bumpPillar(ctxMulti, { currency: 'GBP', curveType: 'Discount', tenorDays: 365 }, 0.0001),
    ).toThrow(/no curves seeded for GBP/)
  })

  test('unknown tenor is a fatal error', () => {
    expect(() =>
      bumpPillar(ctxSingle, { currency: 'USD', curveType: 'Discount', tenorDays: 999 }, 0.0001),
    ).toThrow(/no pillar at tenorDays=999/)
  })
})

describe('bumpFxSpot', () => {
  test('multiplies the requested pair by (1 + relativeBump)', () => {
    const out = bumpFxSpot(ctxMulti, 'EURUSD', 0.01)
    expect(out.fxSpots!.EURUSD).toBeCloseTo(1.1 * 1.01, 12)
  })

  test('throws when pair is not seeded', () => {
    expect(() => bumpFxSpot(ctxMulti, 'GBPUSD', 0.01)).toThrow(/No FxSpot seeded for GBPUSD/)
  })

  test('throws when fxSpots missing entirely', () => {
    expect(() => bumpFxSpot(ctxSingle, 'EURUSD', 0.01)).toThrow(/No FxSpot seeded/)
  })
})

describe('bumpCreditSpread', () => {
  test('adds bp to ctx.creditSpread when set', () => {
    const ctx: PricingContext = { ...ctxSingle, creditSpread: 0.03 }
    const out = bumpCreditSpread(ctx, 0.0001)
    expect(out.creditSpread).toBeCloseTo(0.0301, 12)
  })

  test('treats absent creditSpread as DEFAULT_CREDIT_SPREAD and adds bp', () => {
    const out = bumpCreditSpread(ctxSingle, 0.0001)
    expect(out.creditSpread).toBeCloseTo(DEFAULT_CREDIT_SPREAD + 0.0001, 12)
  })

  test('does not mutate input', () => {
    const ctx: PricingContext = { ...ctxSingle, creditSpread: 0.03 }
    bumpCreditSpread(ctx, 0.0001)
    expect(ctx.creditSpread).toBe(0.03)
  })
})
