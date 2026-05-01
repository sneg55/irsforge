import type { DiscountCurve } from './types.js'

export function interpolateZero(curve: DiscountCurve, tenorDays: number): number {
  if (curve.interpolation === 'LogLinearDF') {
    const df = logLinearDF(curve.pillars, tenorDays)
    const t = tenorDays / 365
    if (t <= 0) return 0
    return (1 / df - 1) / t
  }
  return linearZero(curve.pillars, tenorDays)
}

export function discountFactor(curve: DiscountCurve, tenorDays: number): number {
  if (tenorDays <= 0) return 1
  if (curve.interpolation === 'LogLinearDF') {
    return logLinearDF(curve.pillars, tenorDays)
  }
  const rate = linearZero(curve.pillars, tenorDays)
  const divisor = curve.dayCount === 'Act365F' ? 365 : 360
  return 1 / (1 + rate * (tenorDays / divisor))
}

function linearZero(pillars: { tenorDays: number; zeroRate: number }[], tenorDays: number): number {
  if (pillars.length === 0) return 0
  if (tenorDays <= pillars[0].tenorDays) return pillars[0].zeroRate
  if (tenorDays >= pillars[pillars.length - 1].tenorDays)
    return pillars[pillars.length - 1].zeroRate
  for (let i = 0; i < pillars.length - 1; i++) {
    if (tenorDays >= pillars[i].tenorDays && tenorDays <= pillars[i + 1].tenorDays) {
      const frac =
        (tenorDays - pillars[i].tenorDays) / (pillars[i + 1].tenorDays - pillars[i].tenorDays)
      return pillars[i].zeroRate + frac * (pillars[i + 1].zeroRate - pillars[i].zeroRate)
    }
  }
  return pillars[pillars.length - 1].zeroRate
}

function pillarDF(p: { tenorDays: number; zeroRate: number }): number {
  return 1 / (1 + (p.zeroRate * p.tenorDays) / 365)
}

function logLinearDF(
  pillars: { tenorDays: number; zeroRate: number }[],
  tenorDays: number,
): number {
  if (pillars.length === 0) return 1
  if (tenorDays <= pillars[0].tenorDays) return pillarDF(pillars[0])
  if (tenorDays >= pillars[pillars.length - 1].tenorDays)
    return pillarDF(pillars[pillars.length - 1])
  for (let i = 0; i < pillars.length - 1; i++) {
    if (tenorDays >= pillars[i].tenorDays && tenorDays <= pillars[i + 1].tenorDays) {
      const df1 = pillarDF(pillars[i])
      const df2 = pillarDF(pillars[i + 1])
      const frac =
        (tenorDays - pillars[i].tenorDays) / (pillars[i + 1].tenorDays - pillars[i].tenorDays)
      return Math.exp((1 - frac) * Math.log(df1) + frac * Math.log(df2))
    }
  }
  return pillarDF(pillars[pillars.length - 1])
}
