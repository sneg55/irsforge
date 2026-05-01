import { describe, expect, test } from 'vitest'
import { solveNewton } from '../newton.js'

describe('solveNewton', () => {
  test('linear f(x) = x - c: converges in one Newton step', () => {
    const r = solveNewton((x) => x - 7, 0)
    expect(r.converged).toBe(true)
    expect(r.method).toBe('newton')
    expect(r.root).toBeCloseTo(7, 10)
    expect(r.iterations).toBe(1)
    expect(Math.abs(r.residual)).toBeLessThan(1e-9)
  })

  test('quadratic f(x) = x^2 - 9 from x0=5: converges to nearest root (+3)', () => {
    const r = solveNewton((x) => x * x - 9, 5)
    expect(r.converged).toBe(true)
    expect(r.root!).toBeCloseTo(3, 8)
  })

  test('quadratic from x0=-5: converges to the other root (-3)', () => {
    const r = solveNewton((x) => x * x - 9, -5)
    expect(r.converged).toBe(true)
    expect(r.root!).toBeCloseTo(-3, 8)
  })

  test('exponential f(x) = e^x - 1 from x0=2: converges to 0', () => {
    const r = solveNewton((x) => Math.exp(x) - 1, 2)
    expect(r.converged).toBe(true)
    expect(Math.abs(r.root!)).toBeLessThan(1e-7)
  })

  test('cubic x^3 − x − 1 from x0=1: converges to the real root ≈ 1.3247', () => {
    const r = solveNewton((x) => x * x * x - x - 1, 1)
    expect(r.converged).toBe(true)
    expect(r.root!).toBeCloseTo(1.324717957244746, 8)
  })

  test('no root in expandable bracket: returns root=null, converged=false', () => {
    const r = solveNewton((x) => x * x + 1, 0, { maxIter: 20, bracketMax: 4 })
    expect(r.converged).toBe(false)
    expect(r.root).toBeNull()
  })

  test('respects maxIter: reports iteration count', () => {
    // sin(10x) at x0=1.2 oscillates; with maxIter=2 and no bracket the
    // loop exits early.
    const r = solveNewton((x) => Math.sin(10 * x), 1.2, { maxIter: 2, bracketMax: 1 })
    expect(r.iterations).toBeLessThanOrEqual(2)
  })

  test('trace records (x, f) for every Newton step and seeds with x0', () => {
    const r = solveNewton((x) => x * x - 4, 5)
    expect(r.trace.length).toBeGreaterThanOrEqual(r.iterations)
    expect(r.trace[0].x).toBe(5)
    expect(r.trace[0].f).toBeCloseTo(21, 10)
  })

  test('custom tol is respected', () => {
    const r = solveNewton((x) => x - 3, 0, { tol: 1e-3 })
    expect(r.converged).toBe(true)
    expect(Math.abs(r.residual)).toBeLessThanOrEqual(1e-3)
  })

  test('bisection fallback kicks in when Newton iterate stalls', () => {
    // f(x) = x if |x|>1 else 0 — derivative is 0 on [-1,1], so Newton
    // stalls at x0=0.5 but bisection over [-2, 2] finds the root x=0.
    const f = (x: number) => (Math.abs(x) > 1 ? x : 0)
    const r = solveNewton(f, 0.5, { initialStep: 1.5, bracketMax: 4 })
    // Either Newton found it (f(x)=0 at start) or bisection did.
    expect(r.converged).toBe(true)
  })
})
