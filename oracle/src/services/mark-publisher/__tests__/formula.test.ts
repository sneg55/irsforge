import { describe, expect, it } from 'vitest'
import { computeRequired, gateCall } from '../formula.js'

describe('gateCall', () => {
  it('returns 0 when |raw| < mta', () => {
    expect(gateCall(50_000, 100_000, 10_000)).toBe(0)
  })
  it('rounds positive raw to nearest rounding', () => {
    expect(gateCall(123_456, 100_000, 10_000)).toBe(120_000)
  })
  it('returns raw unchanged when rounding == 0', () => {
    expect(gateCall(123_456, 100_000, 0)).toBe(123_456)
  })
  it('rounds negative raw symmetrically', () => {
    expect(gateCall(-123_456, 100_000, 10_000)).toBe(-120_000)
  })
})

describe('computeRequired', () => {
  it('positive exposure ⇒ A funds', () => {
    expect(computeRequired(1_000_000, 0, 0)).toEqual({ fromA: 1_000_000, fromB: 0 })
  })
  it('negative exposure ⇒ B funds', () => {
    expect(computeRequired(-500_000, 0, 0)).toEqual({ fromA: 0, fromB: 500_000 })
  })
  it('threshold reduces required amount', () => {
    expect(computeRequired(300_000, 250_000, 250_000)).toEqual({ fromA: 50_000, fromB: 0 })
  })
})
