export interface NewtonOptions {
  tol?: number
  relTol?: number
  scale?: number
  maxIter?: number
  initialStep?: number
  bracketMax?: number
}

export interface NewtonResult {
  root: number | null
  iterations: number
  residual: number
  converged: boolean
  trace: { x: number; f: number }[]
  method: 'newton' | 'bisection' | 'none'
}

const DEFAULT_TOL = 1e-9
const DEFAULT_MAX_ITER = 50
const DEFAULT_STEP = 1e-4
const DEFAULT_BRACKET = 32

function numericalSlope(f: (x: number) => number, x: number, h: number): number {
  return (f(x + h) - f(x - h)) / (2 * h)
}

function bisect(
  f: (x: number) => number,
  lo: number,
  fLo: number,
  hi: number,
  fHi: number,
  tol: number,
  maxIter: number,
  trace: { x: number; f: number }[],
): { root: number | null; residual: number; iterations: number } {
  if (fLo * fHi > 0) {
    return { root: null, residual: Math.min(Math.abs(fLo), Math.abs(fHi)), iterations: 0 }
  }
  let a = lo,
    b = hi,
    fa = fLo
  let iter = 0
  while (iter < maxIter) {
    const mid = 0.5 * (a + b)
    const fm = f(mid)
    trace.push({ x: mid, f: fm })
    iter += 1
    if (Math.abs(fm) <= tol || Math.abs(b - a) < tol) {
      return { root: mid, residual: fm, iterations: iter }
    }
    if (fa * fm <= 0) {
      b = mid
    } else {
      a = mid
      fa = fm
    }
  }
  const mid = 0.5 * (a + b)
  return { root: mid, residual: f(mid), iterations: iter }
}

function expandBracket(
  f: (x: number) => number,
  x0: number,
  step: number,
  maxDoubles: number,
  trace: { x: number; f: number }[],
): { lo: number; fLo: number; hi: number; fHi: number } | null {
  let width = Math.max(Math.abs(step), 1e-12)
  for (let i = 0; i < maxDoubles; i++) {
    const lo = x0 - width,
      hi = x0 + width
    const fLo = f(lo),
      fHi = f(hi)
    trace.push({ x: lo, f: fLo })
    trace.push({ x: hi, f: fHi })
    if (fLo * fHi <= 0) return { lo, fLo, hi, fHi }
    width *= 2
  }
  return null
}

export function solveNewton(
  f: (x: number) => number,
  x0: number,
  opts: NewtonOptions = {},
): NewtonResult {
  const absTol = opts.tol ?? DEFAULT_TOL
  const relTol = opts.relTol ?? 1e-10
  const scale = opts.scale ?? 0
  const tol = Math.max(absTol, relTol * Math.abs(scale))
  const maxIter = opts.maxIter ?? DEFAULT_MAX_ITER
  const step = opts.initialStep ?? DEFAULT_STEP
  const bracketMax = opts.bracketMax ?? DEFAULT_BRACKET

  const trace: { x: number; f: number }[] = []
  let x = x0
  let fx = f(x)
  trace.push({ x, f: fx })

  if (Math.abs(fx) <= tol) {
    return { root: x, iterations: 0, residual: fx, converged: true, trace, method: 'newton' }
  }

  let iterations = 0
  let bestX = x
  let bestAbs = Math.abs(fx)
  let stalled = false

  for (let i = 0; i < maxIter; i++) {
    const slope = numericalSlope(f, x, step)
    if (!Number.isFinite(slope) || Math.abs(slope) < step * step) {
      stalled = true
      break
    }
    const next = x - fx / slope
    if (!Number.isFinite(next)) {
      stalled = true
      break
    }
    const fNext = f(next)
    iterations += 1
    trace.push({ x: next, f: fNext })
    if (Math.abs(fNext) < bestAbs) {
      bestAbs = Math.abs(fNext)
      bestX = next
    }
    x = next
    fx = fNext
    if (Math.abs(fx) <= tol) {
      return { root: x, iterations, residual: fx, converged: true, trace, method: 'newton' }
    }
  }

  const doubles = Math.max(1, Math.ceil(Math.log2(Math.max(bracketMax, 2))) + 1)
  const bracket = expandBracket(f, x0, step, doubles, trace)
  if (!bracket) {
    return {
      root: null,
      iterations,
      residual: bestAbs,
      converged: false,
      trace,
      method: stalled ? 'none' : 'newton',
    }
  }
  const bis = bisect(f, bracket.lo, bracket.fLo, bracket.hi, bracket.fHi, tol, maxIter, trace)
  if (bis.root === null) {
    return { root: null, iterations, residual: bestAbs, converged: false, trace, method: 'none' }
  }
  const residual = Math.abs(bis.residual)
  void bestX
  return {
    root: bis.root,
    iterations,
    residual: bis.residual,
    converged: residual <= tol,
    trace,
    method: 'bisection',
  }
}
