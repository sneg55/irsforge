import { describe, expect, it } from 'vitest'
import { calcCompoundedCashflow } from '../cashflows.js'
import type { DiscountCurve, FloatingRateIndex, RateObservation } from '../types.js'
import fixture from './fixtures/sofr-index-2023.json'

const observations: RateObservation[] = fixture.daily.map((d) => ({
  date: new Date(`${d.date}T00:00:00Z`),
  rate: d.rate,
}))

const sofrIndex: FloatingRateIndex = {
  indexId: 'USD-SOFR',
  currency: 'USD',
  family: 'SOFR',
  compounding: 'CompoundedInArrears',
  lookback: 0,
  floor: null,
}

const projectionCurve: DiscountCurve = {
  currency: 'USD',
  curveType: 'Projection',
  indexId: 'USD-SOFR',
  asOf: '2023-10-02',
  pillars: [
    { tenorDays: 1, zeroRate: 0.05 },
    { tenorDays: 3652, zeroRate: 0.05 },
  ],
  interpolation: 'LinearZero',
  dayCount: 'Act360',
}

describe('calcCompoundedCashflow — forward-only period', () => {
  it('with no observations and a flat 5% forward curve, ≈ notional × 5% × 90/360', () => {
    const flatCurve: DiscountCurve = {
      currency: 'USD',
      curveType: 'Projection',
      indexId: 'USD-SOFR',
      asOf: '2024-01-01',
      pillars: [
        { tenorDays: 1, zeroRate: 0.05 },
        { tenorDays: 3652, zeroRate: 0.05 },
      ],
      interpolation: 'LinearZero',
      dayCount: 'Act360',
    }
    const periodStart = new Date('2024-01-02T00:00:00Z')
    const periodEnd = new Date('2024-04-02T00:00:00Z')
    const notional = 100_000_000

    const cashflow = calcCompoundedCashflow({
      curve: flatCurve,
      index: { ...sofrIndex, lookback: 0 },
      observations: [],
      periodStart,
      periodEnd,
      notional,
    })

    const days = (periodEnd.getTime() - periodStart.getTime()) / 86400000
    const simple = (notional * 0.05 * days) / 360
    const relErr = Math.abs(cashflow - simple) / simple
    expect(relErr).toBeLessThan(0.001)
  })
})

describe('calcCompoundedCashflow — NY Fed SOFR Index parity', () => {
  it('reproduces the NY Fed SOFR Index over 2023-10-02 → 2023-12-29 to ≤ 0.1 bp', () => {
    const periodStart = new Date('2023-10-02T00:00:00Z')
    const periodEnd = new Date('2023-12-29T00:00:00Z')
    const notional = 100_000_000

    const cashflow = calcCompoundedCashflow({
      curve: projectionCurve,
      index: sofrIndex,
      observations,
      periodStart,
      periodEnd,
      notional,
    })

    const idxStart = fixture.indexValues.find((v) => v.date === '2023-10-02')!.index
    const idxEnd = fixture.indexValues.find((v) => v.date === '2023-12-29')!.index
    const published = notional * (idxEnd / idxStart - 1)

    const diffBp = (Math.abs(cashflow - published) / notional) * 10_000
    expect(diffBp).toBeLessThanOrEqual(0.1)
  })
})
