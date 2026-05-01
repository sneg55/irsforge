import { describe, expect, it } from 'vitest'
import { solveNewton } from '../newton.js'

describe('Newton relative tolerance', () => {
  it('converges when |f| / scale < relTol even if |f| > absTol', () => {
    // Simulate NPV function that hits a numerical floor of ~1.86e-9 near the root
    // (the exact BASIS-spread failure residual). Without relTol this reports
    // "did not converge". With scale=1e7, effectiveTol = max(1e-9, 1e-10 * 1e7)
    // = 1e-3, so 1.86e-9 << 1e-3 → converged.
    const TRUE_ROOT = 0.05
    const f = (x: number) => {
      const base = 1e7 * (x - TRUE_ROOT)
      // Floor: numerical imprecision means residual never drops below ~2e-9
      return Math.abs(base) < 2e-9 ? 1.86e-9 : base
    }
    const res = solveNewton(f, 0, { relTol: 1e-10, scale: 1e7 })
    expect(res.converged).toBe(true)
    expect(res.root).toBeCloseTo(TRUE_ROOT, 4)
  })

  it('fails without relTol (demonstrates the pre-fix behaviour)', () => {
    const TRUE_ROOT = 0.05
    const f = (x: number) => {
      const base = 1e7 * (x - TRUE_ROOT)
      return Math.abs(base) < 2e-9 ? 1.86e-9 : base
    }
    // default absolute-only tolerance — cannot converge through the floor
    const res = solveNewton(f, 0, {})
    expect(res.converged).toBe(false)
  })

  it('still respects absolute tolerance when no scale given', () => {
    const f = (x: number) => x - 0.05
    const res = solveNewton(f, 0, {})
    expect(res.converged).toBe(true)
  })
})
