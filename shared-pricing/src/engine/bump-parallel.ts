import type { CurveBook, DiscountCurve, PricingContext } from './types.js'

/**
 * Parallel-curve bump primitive. Lives on the engine side because the engine's
 * own `calcRiskMetrics` (parallel-DV01 / convexity / mod-duration) is the first
 * caller; `risk/bump.ts` re-exports `bumpParallel` so the public API on
 * `shared-pricing` is unchanged. Keeping it here also keeps `engine/` free of
 * any `../risk/*` import — the two layers form a clean one-way dependency
 * (`risk/ → engine/`).
 *
 * `shiftAllPillars` and `shiftBookAll` stay module-private; external callers
 * that need them can compose `bumpParallel` instead.
 */

function shiftAllPillars(curve: DiscountCurve, bp: number): DiscountCurve {
  return { ...curve, pillars: curve.pillars.map((p) => ({ ...p, zeroRate: p.zeroRate + bp })) }
}

function shiftBookAll(book: CurveBook, bp: number): CurveBook {
  const byCurrency: CurveBook['byCurrency'] = {}
  for (const [ccy, pair] of Object.entries(book.byCurrency)) {
    const projections: typeof pair.projections = {}
    for (const [id, proj] of Object.entries(pair.projections)) {
      projections[id] = shiftAllPillars(proj, bp)
    }
    byCurrency[ccy] = {
      discount: shiftAllPillars(pair.discount, bp),
      projections,
    }
  }
  return { asOf: book.asOf, byCurrency }
}

export function bumpParallel(ctx: PricingContext, bp: number): PricingContext {
  return {
    ...ctx,
    curve: shiftAllPillars(ctx.curve, bp),
    book: ctx.book ? shiftBookAll(ctx.book, bp) : ctx.book,
  }
}
