import { describe, expect, test } from 'vitest'
import { yearFraction } from '../day-count.js'

describe('yearFraction', () => {
  test('ACT_360: 90 days = 0.25', () => {
    const start = new Date(2026, 3, 15) // Apr 15
    const end = new Date(2026, 6, 14) // Jul 14
    expect(yearFraction(start, end, 'ACT_360')).toBeCloseTo(0.25, 4)
  })
  test('ACT_365: full year = 1.0', () => {
    expect(yearFraction(new Date(2026, 0, 1), new Date(2027, 0, 1), 'ACT_365')).toBeCloseTo(1.0, 4)
  })
  test('THIRTY_360: quarter = 0.25', () => {
    expect(yearFraction(new Date(2026, 0, 15), new Date(2026, 3, 15), 'THIRTY_360')).toBeCloseTo(
      0.25,
      4,
    )
  })
})
