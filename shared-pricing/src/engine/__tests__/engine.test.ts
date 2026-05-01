import { describe, expect, test } from 'vitest'
import { pricingEngine } from '../price.js'
import type { DiscountCurve, FloatingRateIndex, PricingContext, SwapConfig } from '../types.js'

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

const sofrIndex: FloatingRateIndex = {
  indexId: 'USD-SOFR',
  currency: 'USD',
  family: 'SOFR',
  compounding: 'CompoundedInArrears',
  lookback: 0,
  floor: null,
}

const ctx: PricingContext = { curve, index: sofrIndex, observations: [] }

describe('pricingEngine', () => {
  test('IRS: returns complete ValuationResult', () => {
    const config: SwapConfig = {
      type: 'IRS',
      tradeDate: new Date(2026, 3, 10),
      effectiveDate: new Date(2026, 3, 15),
      maturityDate: new Date(2031, 3, 15),
      legs: [
        {
          legType: 'fixed',
          currency: 'USD',
          notional: 50e6,
          rate: 0.0425,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date(2026, 3, 15),
            endDate: new Date(2031, 3, 15),
            frequency: 'Quarterly',
          },
        },
        {
          legType: 'float',
          currency: 'USD',
          notional: 50e6,
          indexId: 'SOFR',
          spread: 0,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date(2026, 3, 15),
            endDate: new Date(2031, 3, 15),
            frequency: 'Quarterly',
          },
        },
      ],
    }
    const result = pricingEngine.price(config, ctx)
    expect(result.legPVs).toHaveLength(2)
    expect(typeof result.npv).toBe('number')
    expect(Number.isFinite(result.npv)).toBe(true)
    expect(typeof result.dv01).toBe('number')
    expect(result.dv01).toBeGreaterThan(0)
    expect(result.parRate).not.toBeNull()
    expect(result.cashflows).toHaveLength(2)
    expect(result.cashflows[0].length).toBeGreaterThan(0)
  })

  test('CDS: returns result with 2 legs', () => {
    const config: SwapConfig = {
      type: 'CDS',
      tradeDate: new Date(2026, 3, 10),
      effectiveDate: new Date(2026, 3, 15),
      maturityDate: new Date(2031, 3, 15),
      legs: [
        {
          legType: 'fixed',
          currency: 'USD',
          notional: 10e6,
          rate: 0.01,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date(2026, 3, 15),
            endDate: new Date(2031, 3, 15),
            frequency: 'Quarterly',
          },
        },
        { legType: 'protection', notional: 10e6, recoveryRate: 0.4 },
      ],
    }
    const result = pricingEngine.price(config, ctx)
    expect(result.legPVs).toHaveLength(2)
    expect(result.cashflows).toHaveLength(2)
  })

  test('FpML: handles multi-leg', () => {
    const config: SwapConfig = {
      type: 'FpML',
      tradeDate: new Date(2026, 3, 10),
      effectiveDate: new Date(2026, 3, 15),
      maturityDate: new Date(2027, 3, 15),
      legs: [
        {
          legType: 'float',
          currency: 'USD',
          notional: 50e6,
          indexId: 'SOFR',
          spread: 0,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date(2026, 3, 15),
            endDate: new Date(2027, 3, 15),
            frequency: 'Quarterly',
          },
        },
        {
          legType: 'float',
          currency: 'USD',
          notional: 50e6,
          indexId: 'EURIBOR',
          spread: 0.001,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date(2026, 3, 15),
            endDate: new Date(2027, 3, 15),
            frequency: 'Quarterly',
          },
        },
        {
          legType: 'fixed',
          currency: 'USD',
          notional: 10e6,
          rate: 0.03,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date(2026, 3, 15),
            endDate: new Date(2027, 3, 15),
            frequency: 'Quarterly',
          },
        },
      ],
    }
    const result = pricingEngine.price(config, ctx)
    expect(result.legPVs).toHaveLength(3)
    expect(result.cashflows).toHaveLength(3)
  })

  test('DV01 is positive and reasonable', () => {
    const config: SwapConfig = {
      type: 'IRS',
      tradeDate: new Date(2026, 3, 10),
      effectiveDate: new Date(2026, 3, 15),
      maturityDate: new Date(2031, 3, 15),
      legs: [
        {
          legType: 'fixed',
          currency: 'USD',
          notional: 50e6,
          rate: 0.0425,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date(2026, 3, 15),
            endDate: new Date(2031, 3, 15),
            frequency: 'Quarterly',
          },
        },
        {
          legType: 'float',
          currency: 'USD',
          notional: 50e6,
          indexId: 'SOFR',
          spread: 0,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date(2026, 3, 15),
            endDate: new Date(2031, 3, 15),
            frequency: 'Quarterly',
          },
        },
      ],
    }
    const result = pricingEngine.price(config, ctx)
    expect(result.dv01).toBeGreaterThan(0)
    expect(result.dv01).toBeLessThan(500_000)
  })
})
