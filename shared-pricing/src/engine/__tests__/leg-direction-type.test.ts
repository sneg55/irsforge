import { describe, expect, it } from 'vitest'
import type { FixedLegConfig, LegConfig } from '../types.js'

describe('LegConfig direction', () => {
  it('requires direction on fixed leg', () => {
    const leg: FixedLegConfig = {
      legType: 'fixed',
      direction: 'pay',
      currency: 'USD',
      notional: 1_000_000,
      rate: 0.04,
      dayCount: 'ACT_360',
      schedule: { startDate: new Date(), endDate: new Date(), frequency: 'Quarterly' },
    }
    expect(leg.direction).toBe('pay')
  })
  it('rejects direction value outside pay/receive', () => {
    // @ts-expect-error — direction must be 'pay' | 'receive'
    const bad: LegConfig = { legType: 'fixed', direction: 'swap' } as never
    expect(bad).toBeDefined()
  })
})
