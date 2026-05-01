import { describe, expect, test } from 'vitest'
import { calcFixedCashflows, calcFloatCashflows, generateScheduleDates } from '../cashflows.js'
import type { DiscountCurve } from '../types.js'

describe('generateScheduleDates', () => {
  test('quarterly dates for 1 year', () => {
    const dates = generateScheduleDates(new Date(2026, 3, 15), new Date(2027, 3, 15), 'Quarterly')
    expect(dates).toHaveLength(4)
    // Each date should be ~3 months apart
    expect(dates[0].getMonth()).toBe(6) // Jul
    expect(dates[1].getMonth()).toBe(9) // Oct
  })
  test('monthly dates for 6 months', () => {
    const dates = generateScheduleDates(new Date(2026, 0, 1), new Date(2026, 6, 1), 'Monthly')
    expect(dates).toHaveLength(6)
  })
  test('semi-annual for 2 years', () => {
    const dates = generateScheduleDates(new Date(2026, 0, 1), new Date(2028, 0, 1), 'SemiAnnual')
    expect(dates).toHaveLength(4)
  })
  test('annual for 5 years', () => {
    const dates = generateScheduleDates(new Date(2026, 3, 15), new Date(2031, 3, 15), 'Annual')
    expect(dates).toHaveLength(5)
  })
})

describe('calcFixedCashflows', () => {
  test('quarterly fixed at 4.25% on 50M notional', () => {
    const cfs = calcFixedCashflows(0.0425, 50_000_000, 'ACT_360', {
      startDate: new Date(2026, 3, 15),
      endDate: new Date(2027, 3, 15),
      frequency: 'Quarterly',
    })
    expect(cfs.length).toBe(4)
    cfs.forEach((cf) => expect(Math.abs(cf.amount)).toBeGreaterThan(500_000))
  })
})

describe('calcFloatCashflows', () => {
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

  test('quarterly float with SOFR + 25bp on 50M', () => {
    const cfs = calcFloatCashflows(curve, 0.0025, 50_000_000, 'ACT_360', {
      startDate: new Date(2026, 3, 15),
      endDate: new Date(2027, 3, 15),
      frequency: 'Quarterly',
    })
    expect(cfs.length).toBe(4)
    cfs.forEach((cf) => {
      expect(Math.abs(cf.amount)).toBeGreaterThan(400_000)
      expect(cf.projectedRate).toBeDefined()
      expect(cf.projectedRate).toBeGreaterThan(0)
    })
  })
})
