import { describe, expect, test } from 'vitest'
import { pricingEngine } from '../../engine/price.js'
import type {
  CurveBook,
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  ProtectionLegConfig,
  SwapConfig,
} from '../../engine/types.js'
import { accrued, clean, dirty } from '../accrued.js'

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

const sofr: FloatingRateIndex = {
  indexId: 'USD-SOFR',
  currency: 'USD',
  family: 'SOFR',
  compounding: 'CompoundedInArrears',
  lookback: 0,
  floor: null,
}

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

function invariant(
  config: SwapConfig,
  ctx: PricingContext,
  _label: string,
  expectedAccrued?: number,
): void {
  const { npv } = pricingEngine.price(config, ctx)
  const acc = accrued(config, ctx)
  const cln = clean(config, ctx)
  const drt = dirty(config, ctx)
  expect(drt).toBeCloseTo(npv, 12)
  expect(cln + acc).toBeCloseTo(npv, 10)
  expect(Math.abs(cln + acc - drt)).toBeLessThan(1e-10 * Math.max(Math.abs(npv), 1))
  // Pin the observed accrued magnitude per family. The invariant above
  // is tautological given `clean = dirty - accrued`, so a sign flip
  // inside `accrued` would be silently absorbed by `clean`. Asserting
  // a hand-verified numeric value catches regressions that preserve
  // the linear relation but break the accrual direction or magnitude.
  if (expectedAccrued !== undefined) {
    expect(acc).toBeCloseTo(expectedAccrued, 2)
  }
}

describe('accrued / clean / dirty invariant', () => {
  const ctx: PricingContext = { curve: mkCurve('USD', 'Discount'), index: sofr, observations: [] }

  test('IRS: clean + accrued = dirty = NPV', () => {
    const irs: SwapConfig = {
      type: 'IRS',
      legs: [fixedLeg, floatLeg],
      tradeDate: new Date(2026, 0, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    invariant(irs, ctx, 'IRS', -7083.33)
  })

  test('OIS: clean + accrued = dirty = NPV', () => {
    const annualSched = { ...schedule, frequency: 'Annual' as const }
    const ois: SwapConfig = {
      type: 'OIS',
      legs: [
        { ...fixedLeg, schedule: annualSched },
        { ...floatLeg, schedule: annualSched },
      ],
      tradeDate: new Date(2026, 0, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    invariant(ois, ctx, 'OIS', -7083.33)
  })

  test('BASIS: clean + accrued = dirty = NPV', () => {
    const fedFunds: FloatingRateIndex = { ...sofr, indexId: 'USD-FedFunds' }
    const book: CurveBook = {
      asOf: '2026-04-10T00:00:00Z',
      byCurrency: {
        USD: {
          discount: mkCurve('USD', 'Discount'),
          projections: {
            'USD-SOFR': mkCurve('USD', 'Projection'),
            'USD-FedFunds': mkCurve('USD', 'Projection'),
          },
        },
      },
    }
    const legA: FloatLegConfig = { ...floatLeg, notional: 50e6, indexId: 'SOFR' }
    const legB: FloatLegConfig = {
      ...floatLeg,
      notional: -50e6,
      indexId: 'FedFunds',
      spread: 0.001,
    }
    const basis: SwapConfig = {
      type: 'BASIS',
      legs: [legA, legB],
      tradeDate: new Date(2026, 0, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const ctxBasis: PricingContext = { ...ctx, indicesByLeg: [sofr, fedFunds], book }
    invariant(basis, ctxBasis, 'BASIS', -11805.56)
  })

  test('XCCY: clean + accrued = dirty = NPV (reporting currency)', () => {
    const usdLeg: FixedLegConfig = { ...fixedLeg, currency: 'USD' }
    const eurLeg: FloatLegConfig = { ...floatLeg, currency: 'EUR', notional: -50e6 * 1.1 }
    const book: CurveBook = {
      asOf: '2026-04-10T00:00:00Z',
      byCurrency: {
        USD: {
          discount: mkCurve('USD', 'Discount'),
          projections: { 'USD-SOFR': mkCurve('USD', 'Projection') },
        },
        EUR: {
          discount: mkCurve('EUR', 'Discount'),
          projections: { 'EUR-ESTR': mkCurve('EUR', 'Projection') },
        },
      },
    }
    const xccy: SwapConfig = {
      type: 'XCCY',
      legs: [usdLeg, eurLeg],
      tradeDate: new Date(2026, 0, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const ctxX: PricingContext = {
      ...ctx,
      book,
      fxSpots: { EURUSD: 1.1 },
      reportingCcy: 'USD',
    }
    invariant(xccy, ctxX, 'XCCY', -113935.42)
  })

  test('CDS: clean + accrued = dirty = NPV (premium leg accrues, protection does not)', () => {
    const premiumLeg: FixedLegConfig = {
      legType: 'fixed',
      currency: 'USD',
      notional: 10e6,
      rate: 0.01,
      dayCount: 'ACT_360',
      schedule,
    }
    const protectionLeg: ProtectionLegConfig = {
      legType: 'protection',
      notional: 10e6,
      recoveryRate: 0.4,
    }
    const cds: SwapConfig = {
      type: 'CDS',
      legs: [premiumLeg, protectionLeg],
      tradeDate: new Date(2026, 0, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    invariant(cds, ctx, 'CDS', 23604.64)
  })

  test('accrued is 0 before effective date', () => {
    const irs: SwapConfig = {
      type: 'IRS',
      legs: [fixedLeg, floatLeg],
      tradeDate: new Date(2026, 0, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const preStartCtx: PricingContext = {
      ...ctx,
      curve: { ...ctx.curve, asOf: '2025-12-01T00:00:00Z' },
    }
    expect(accrued(irs, preStartCtx)).toBe(0)
  })

  test('accrued is 0 after final period end', () => {
    const irs: SwapConfig = {
      type: 'IRS',
      legs: [fixedLeg, floatLeg],
      tradeDate: new Date(2026, 0, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    const postEndCtx: PricingContext = {
      ...ctx,
      curve: { ...ctx.curve, asOf: '2028-06-01T00:00:00Z' },
    }
    expect(accrued(irs, postEndCtx)).toBe(0)
  })

  test('FX: accrued is 0 (single-event cashflow, no linear accrual)', () => {
    const fxLeg = {
      legType: 'fx' as const,
      baseCurrency: 'USD',
      foreignCurrency: 'EUR',
      notional: 10e6,
      fxRate: 1.1,
      paymentDate: new Date(2026, 5, 15),
    }
    const fx: SwapConfig = {
      type: 'FX',
      legs: [fxLeg],
      tradeDate: new Date(2026, 0, 10),
      effectiveDate: schedule.startDate,
      maturityDate: schedule.endDate,
    }
    expect(accrued(fx, ctx)).toBe(0)
  })
})
