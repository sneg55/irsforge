/**
 * Currency-conversion factor for translating a leg PV / accrual from its
 * payment currency to a reporting currency. Returns 1 when currencies
 * match, otherwise looks up the direct pair, then the inverse. Throws
 * with the seed-file hint if neither side is present so callers fail
 * loud rather than silently fall back to an arbitrary rate.
 */
export function fxFactor(fromCcy: string, toCcy: string, fxSpots: Record<string, number>): number {
  if (fromCcy === toCcy) return 1
  const direct = fxSpots[`${fromCcy}${toCcy}`]
  if (direct) return direct
  const inverse = fxSpots[`${toCcy}${fromCcy}`]
  if (inverse) return 1 / inverse
  throw new Error(`No FxSpot seeded for ${fromCcy}↔${toCcy}. Add the pair to demo.fxSpots.`)
}
