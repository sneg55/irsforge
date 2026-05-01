import type { DiscountCurve, PricingContext } from '../types.js'

/**
 * Resolve the projection curve for a given (currency, indexId) pair.
 *
 * Fallback chain:
 *   1. book.byCurrency[currency].projections[indexId]  — exact match
 *   2. first projection for that currency              — single-projection books
 *   3. ctx.curve                                        — no book seeded
 */
export function resolveProjection(
  ctx: PricingContext,
  currency: string,
  indexId: string | null | undefined,
): DiscountCurve {
  const ccyEntry = ctx.book?.byCurrency[currency]
  if (!ccyEntry) return ctx.curve
  if (indexId && ccyEntry.projections[indexId]) return ccyEntry.projections[indexId]
  // fallback: first projection for that currency, then ctx.curve
  const first = Object.values(ccyEntry.projections)[0]
  return first ?? ctx.curve
}
