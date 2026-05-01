import { describe, expect, test } from 'vitest'
import fixture from '../../../../shared-config/src/fixtures/curve-interpolation.json'
import { discountFactor, interpolateZero } from '../curves.js'
import type { DiscountCurve } from '../types.js'

function makeCurve(c: (typeof fixture.cases)[0]): DiscountCurve {
  return {
    currency: 'USD',
    curveType: 'Discount',
    indexId: null,
    asOf: '2026-04-15T00:00:00Z',
    pillars: c.pillars.map((p) => ({ tenorDays: p.tenorDays, zeroRate: parseFloat(p.zeroRate) })),
    interpolation: c.interpolation as 'LinearZero' | 'LogLinearDF',
    dayCount: c.dayCount as 'Act360' | 'Act365F',
  }
}

describe('curve interpolation parity', () => {
  for (const c of fixture.cases) {
    describe(c.name, () => {
      const curve = makeCurve(c)
      for (const q of c.queries) {
        test(`interpolateZero at ${q.tenorDays}d`, () => {
          const result = interpolateZero(curve, q.tenorDays)
          expect(result.toFixed(10)).toBe(q.expectedZero)
        })
      }
    })
  }
})

describe('discountFactor basics', () => {
  const curve: DiscountCurve = {
    currency: 'USD',
    curveType: 'Discount',
    indexId: null,
    asOf: '2026-04-15T00:00:00Z',
    pillars: [
      { tenorDays: 30, zeroRate: 0.0433 },
      { tenorDays: 91, zeroRate: 0.0431 },
      { tenorDays: 365, zeroRate: 0.0415 },
    ],
    interpolation: 'LinearZero',
    dayCount: 'Act360',
  }

  test('df at 0 is 1', () => expect(discountFactor(curve, 0)).toBeCloseTo(1.0, 6))
  test('df decreases with time', () => {
    expect(discountFactor(curve, 365)).toBeLessThan(discountFactor(curve, 91))
  })
})
