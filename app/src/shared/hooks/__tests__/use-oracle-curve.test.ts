import type { DiscountCurve } from '@irsforge/shared-pricing'
import { TENOR_DAYS_MAP } from '@irsforge/shared-pricing'
import { describe, expect, test } from 'vitest'

// Simulate what useOracleCurve does with raw observation data
function observationsToCurve(observations: { rateId: string; value: number }[]): DiscountCurve {
  const pillars = observations
    .filter((o) => TENOR_DAYS_MAP[o.rateId])
    .map((o) => ({
      tenorDays: TENOR_DAYS_MAP[o.rateId].tenorDays,
      zeroRate: o.value,
    }))
    .sort((a, b) => a.tenorDays - b.tenorDays)
  return {
    currency: 'USD',
    curveType: 'Discount',
    indexId: null,
    asOf: new Date().toISOString(),
    pillars,
    interpolation: 'LinearZero',
    dayCount: 'Act360',
  }
}

describe('observation-to-curve assembly', () => {
  test('maps SOFR observations to sorted pillars', () => {
    const obs = [
      { rateId: 'SOFR/3M', value: 0.0431 },
      { rateId: 'SOFR/ON', value: 0.0433 },
      { rateId: 'SOFR/1Y', value: 0.0415 },
    ]
    const curve = observationsToCurve(obs)
    expect(curve.pillars).toHaveLength(3)
    // Should be sorted by tenorDays
    expect(curve.pillars[0].tenorDays).toBe(1)
    expect(curve.pillars[1].tenorDays).toBe(91)
    expect(curve.pillars[2].tenorDays).toBe(365)
  })

  test('filters out non-SOFR observations', () => {
    const obs = [
      { rateId: 'SOFR/ON', value: 0.0433 },
      { rateId: 'LIBOR/3M', value: 0.05 },
      { rateId: 'SOFR/1M', value: 0.0433 },
    ]
    const curve = observationsToCurve(obs)
    expect(curve.pillars).toHaveLength(2)
  })

  test('full 9-point curve has correct structure', () => {
    const obs = [
      { rateId: 'SOFR/ON', value: 0.0433 },
      { rateId: 'SOFR/1M', value: 0.0433 },
      { rateId: 'SOFR/3M', value: 0.0431 },
      { rateId: 'SOFR/6M', value: 0.0428 },
      { rateId: 'SOFR/1Y', value: 0.0415 },
      { rateId: 'SOFR/2Y', value: 0.0398 },
      { rateId: 'SOFR/3Y', value: 0.0392 },
      { rateId: 'SOFR/5Y', value: 0.0387 },
      { rateId: 'SOFR/10Y', value: 0.0395 },
    ]
    const curve = observationsToCurve(obs)
    expect(curve.pillars).toHaveLength(9)
    expect(curve.pillars[0].tenorDays).toBe(1)
    expect(curve.pillars[8].tenorDays).toBe(3652)
  })
})
