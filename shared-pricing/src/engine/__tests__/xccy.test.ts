import { describe, expect, test } from 'vitest'
import { pricingEngine } from '../price.js'
import type {
  CurveBook,
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  SwapConfig,
} from '../types.js'

function flatCurve(ccy: string, r: number): DiscountCurve {
  return {
    currency: ccy,
    curveType: 'Discount',
    indexId: null,
    asOf: '2026-04-16T00:00:00Z',
    pillars: [
      { tenorDays: 1, zeroRate: r },
      { tenorDays: 365, zeroRate: r },
      { tenorDays: 1826, zeroRate: r },
    ],
    interpolation: 'LinearZero',
    dayCount: 'Act360',
  }
}

const flatUsd: DiscountCurve = flatCurve('USD', 0.04)
const flatEur: DiscountCurve = flatCurve('EUR', 0.03)

const book: CurveBook = {
  asOf: '2026-04-16T00:00:00Z',
  byCurrency: {
    USD: { discount: flatUsd, projections: { 'USD-SOFR': flatUsd } },
    EUR: { discount: flatEur, projections: { 'EUR-ESTR': flatEur } },
  },
}

const estrIndex: FloatingRateIndex = {
  indexId: 'EUR-ESTR',
  currency: 'EUR',
  family: 'ESTR',
  compounding: 'CompoundedInArrears',
  lookback: 0,
  floor: null,
}

const schedule = {
  startDate: new Date(2026, 3, 16),
  endDate: new Date(2031, 3, 16),
  frequency: 'SemiAnnual' as const,
}

const usdFixedLeg: FixedLegConfig = {
  legType: 'fixed',
  currency: 'USD',
  notional: 10_000_000,
  rate: 0.04,
  dayCount: 'ACT_360',
  schedule,
}

const eurFloatLeg: FloatLegConfig = {
  legType: 'float',
  currency: 'EUR',
  notional: 9_260_000,
  indexId: 'EUR-ESTR',
  spread: 0,
  dayCount: 'ACT_360',
  schedule,
}

function cfg(): SwapConfig {
  return {
    type: 'XCCY',
    legs: [usdFixedLeg, eurFloatLeg],
    tradeDate: new Date(2026, 3, 16),
    effectiveDate: new Date(2026, 3, 16),
    maturityDate: new Date(2031, 3, 16),
  }
}

function ctx(extra: Partial<PricingContext> = {}): PricingContext {
  return {
    curve: flatUsd,
    index: null,
    observations: [],
    indicesByLeg: [null, estrIndex],
    book,
    fxSpots: { EURUSD: 1.08 },
    reportingCcy: 'USD',
    ...extra,
  }
}

describe('XCCY pricing', () => {
  test('returns two leg PVs — one per leg in reporting currency', () => {
    const result = pricingEngine.price(cfg(), ctx())
    expect(result.legPVs).toHaveLength(2)
    expect(Number.isFinite(result.npv)).toBe(true)
  })

  test('leg-1 (EUR) PV is scaled by EURUSD before entering NPV', () => {
    const resultUSD = pricingEngine.price(cfg(), ctx({ reportingCcy: 'USD' }))
    const resultEUR = pricingEngine.price(cfg(), ctx({ reportingCcy: 'EUR' }))
    // Leg 0 (USD) reports 1:1 in USD, at 1/1.08 when reporting EUR
    // Leg 1 (EUR) reports ×1.08 in USD, 1:1 in EUR.
    // Flipping reporting currency inverts the translation on every leg.
    expect(resultUSD.legPVs[0]).toBeCloseTo(resultEUR.legPVs[0] * 1.08, 0)
    expect(resultUSD.legPVs[1]).toBeCloseTo(resultEUR.legPVs[1] * 1.08, 0)
  })

  test('throws if the leg currency has no FxSpot to the reporting currency', () => {
    expect(() => pricingEngine.price(cfg(), ctx({ fxSpots: {} }))).toThrow(/No FxSpot/)
  })

  test('throws if the CurveBook is missing the leg currency', () => {
    const partialBook: CurveBook = {
      asOf: book.asOf,
      byCurrency: { USD: book.byCurrency.USD },
    }
    // The error is thrown during calcLegCashflows (EUR float leg has no book entry).
    expect(() => pricingEngine.price(cfg(), ctx({ book: partialBook }))).toThrow(
      /no curves seeded for EUR/,
    )
  })

  test('accepts inverse FxSpot (USDEUR) when direct (EURUSD) is absent', () => {
    const result = pricingEngine.price(cfg(), ctx({ fxSpots: { USDEUR: 1 / 1.08 } }))
    expect(Number.isFinite(result.npv)).toBe(true)
    // Same leg magnitudes as if we'd passed EURUSD=1.08 directly.
    const direct = pricingEngine.price(cfg(), ctx({ fxSpots: { EURUSD: 1.08 } }))
    expect(result.npv).toBeCloseTo(direct.npv, -2)
  })

  test('principal-exchange cashflows included in leg 0 (USD fixed)', () => {
    const result = pricingEngine.price(cfg(), ctx())
    // Principal exchanges: -10M at start, +10M at maturity. Strategy
    // tags every cashflow with its leg currency; count USD-tagged ones.
    const usdCashflows = result.cashflows[0].filter((cf) => cf.currency === 'USD')
    const hasInitial = usdCashflows.some((cf) => cf.amount === -10_000_000)
    const hasFinal = usdCashflows.some((cf) => cf.amount === 10_000_000)
    expect(hasInitial).toBe(true)
    expect(hasFinal).toBe(true)
  })
})
