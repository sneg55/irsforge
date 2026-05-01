import { describe, expect, test } from 'vitest'
import { buildCurveFromResponse } from '../providers/nyfed/curve-builder.js'
import type { NYFedAllRatesResponse } from '../providers/nyfed/types.js'

const mockResponse: NYFedAllRatesResponse = {
  refRates: [
    {
      effectiveDate: '2026-04-11',
      type: 'SOFR',
      percentRate: 4.33,
      average30Day: 4.33,
      average90Day: 4.31,
      average180Day: 4.28,
    },
    {
      effectiveDate: '2026-04-11',
      type: 'SOFRAI',
      index: 1.23456,
    },
  ],
}

describe('buildCurveFromResponse', () => {
  test('extracts 9 tenor points', () => {
    const points = buildCurveFromResponse(mockResponse)
    expect(points).toHaveLength(9)
  })

  test('overnight rate matches API percentRate / 100', () => {
    const points = buildCurveFromResponse(mockResponse)
    expect(points[0].rateId).toBe('SOFR/ON')
    expect(points[0].rate).toBeCloseTo(0.0433, 6)
  })

  test('30D average maps to 1M tenor', () => {
    const points = buildCurveFromResponse(mockResponse)
    const m1 = points.find((p) => p.rateId === 'SOFR/1M')
    expect(m1).toBeDefined()
    expect(m1!.rate).toBeCloseTo(0.0433, 6)
  })

  test('90D average maps to 3M tenor', () => {
    const points = buildCurveFromResponse(mockResponse)
    const m3 = points.find((p) => p.rateId === 'SOFR/3M')
    expect(m3).toBeDefined()
    expect(m3!.rate).toBeCloseTo(0.0431, 6)
  })

  test('longer tenors extrapolate from 6M', () => {
    const points = buildCurveFromResponse(mockResponse)
    const y1 = points.find((p) => p.rateId === 'SOFR/1Y')!
    const y5 = points.find((p) => p.rateId === 'SOFR/5Y')!
    // With current SOFR shape (slightly inverted), longer tenors should be lower
    expect(y1.rate).toBeLessThan(0.0433)
    expect(y5.rate).toBeLessThan(y1.rate)
  })

  test('all points have correct tenorDays', () => {
    const points = buildCurveFromResponse(mockResponse)
    expect(points[0].tenorDays).toBe(1) // ON
    expect(points[1].tenorDays).toBe(30) // 1M
    expect(points[2].tenorDays).toBe(91) // 3M
    expect(points[8].tenorDays).toBe(3652) // 10Y
  })

  test('throws when SOFR entry is missing', () => {
    const bad: NYFedAllRatesResponse = { refRates: [] }
    expect(() => buildCurveFromResponse(bad)).toThrow('SOFR overnight rate not found')
  })
})
