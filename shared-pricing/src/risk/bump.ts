import { DEFAULT_CREDIT_SPREAD } from '../engine/defaults.js'
import type { CurveBook, DiscountCurve, PricingContext } from '../engine/types.js'

// Re-exported so the public `shared-pricing` surface stays unchanged. The
// primitive itself lives in `engine/` to keep the engine → risk dependency
// one-way (see `engine/bump-parallel.ts`).
export { bumpParallel } from '../engine/bump-parallel.js'

export type PillarSelector = {
  currency: string
  curveType: 'Discount' | 'Projection'
  tenorDays: number
  /**
   * For Projection pillars: identifies which index curve to bump.
   * When absent (legacy / single-projection callers) every projection
   * for the currency is bumped in parallel so old callers see unchanged
   * behaviour.
   */
  indexId?: string
}

function shiftOnePillar(curve: DiscountCurve, tenorDays: number, bp: number): DiscountCurve {
  const idx = curve.pillars.findIndex((p) => p.tenorDays === tenorDays)
  if (idx < 0)
    throw new Error(
      `bumpPillar: no pillar at tenorDays=${tenorDays} on ${curve.currency} ${curve.curveType} curve`,
    )
  const pillars = curve.pillars.map((p, i) => (i === idx ? { ...p, zeroRate: p.zeroRate + bp } : p))
  return { ...curve, pillars }
}

export function bumpPillar(
  ctx: PricingContext,
  selector: PillarSelector,
  bp: number,
): PricingContext {
  const { currency, curveType, tenorDays, indexId } = selector

  if (ctx.book) {
    const pair = ctx.book.byCurrency[currency]
    if (!pair) throw new Error(`bumpPillar: no curves seeded for ${currency}`)

    let bumpedProjections = pair.projections
    if (curveType === 'Projection') {
      if (indexId) {
        // Bump only the named projection curve.
        const proj = pair.projections[indexId]
        if (!proj)
          throw new Error(`bumpPillar: no projection curve for ${currency} indexId=${indexId}`)
        bumpedProjections = { ...pair.projections, [indexId]: shiftOnePillar(proj, tenorDays, bp) }
      } else {
        // Legacy / single-projection callers: bump every projection for the currency.
        bumpedProjections = Object.fromEntries(
          Object.entries(pair.projections).map(([id, proj]) => [
            id,
            shiftOnePillar(proj, tenorDays, bp),
          ]),
        )
      }
    }

    const bumpedPair = {
      discount:
        curveType === 'Discount' ? shiftOnePillar(pair.discount, tenorDays, bp) : pair.discount,
      projections: bumpedProjections,
    }
    const byCurrency = { ...ctx.book.byCurrency, [currency]: bumpedPair }
    const newBook: CurveBook = { asOf: ctx.book.asOf, byCurrency }

    const mirrorsCtxCurve = ctx.curve.currency === currency && ctx.curve.curveType === curveType
    const newCurve = mirrorsCtxCurve ? shiftOnePillar(ctx.curve, tenorDays, bp) : ctx.curve
    return { ...ctx, curve: newCurve, book: newBook }
  }

  if (ctx.curve.currency !== currency || ctx.curve.curveType !== curveType) {
    throw new Error(`bumpPillar: no curves seeded for ${currency} ${curveType}`)
  }
  return { ...ctx, curve: shiftOnePillar(ctx.curve, tenorDays, bp) }
}

export function bumpFxSpot(
  ctx: PricingContext,
  pair: string,
  relativeBump: number,
): PricingContext {
  if (!ctx.fxSpots || !(pair in ctx.fxSpots)) {
    throw new Error(`No FxSpot seeded for ${pair}. Cannot bump.`)
  }
  const next = { ...ctx.fxSpots, [pair]: ctx.fxSpots[pair] * (1 + relativeBump) }
  return { ...ctx, fxSpots: next }
}

export function bumpCreditSpread(ctx: PricingContext, bp: number): PricingContext {
  const base = ctx.creditSpread ?? DEFAULT_CREDIT_SPREAD
  return { ...ctx, creditSpread: base + bp }
}

/**
 * Bump a single named projection curve for (currency, indexId) by `bp` basis points,
 * leaving all other projections and discount curves unchanged. Used by
 * `crossIndexBasisDv01` to isolate sensitivity to one index leg.
 */
export function bumpSingleProjection(
  ctx: PricingContext,
  currency: string,
  indexId: string,
  bp: number,
): PricingContext {
  if (!ctx.book) return ctx
  const entry = ctx.book.byCurrency[currency]
  if (!entry) return ctx
  const original = entry.projections[indexId]
  if (!original) return ctx
  const bumped: DiscountCurve = {
    ...original,
    pillars: original.pillars.map((p) => ({ ...p, zeroRate: p.zeroRate + bp })),
  }
  const nextEntry = {
    discount: entry.discount,
    projections: { ...entry.projections, [indexId]: bumped },
  }
  return {
    ...ctx,
    book: { asOf: ctx.book.asOf, byCurrency: { ...ctx.book.byCurrency, [currency]: nextEntry } },
  }
}
