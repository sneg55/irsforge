import { pricingEngine } from '../engine/price.js'
import type { PricingContext, SwapConfig } from '../engine/types.js'
import {
  bumpCreditSpread,
  bumpFxSpot,
  bumpPillar,
  bumpSingleProjection,
  type PillarSelector,
} from './bump.js'

export interface KeyRateDv01Entry {
  pillarTenorDays: number
  currency: string
  curveType: 'Discount' | 'Projection'
  indexId?: string
  dv01: number
}

const BP = 0.0001

// Collect every currency this swap actually touches so we don't enumerate
// pillars for unrelated book entries. Without this, a USD-only IRS priced
// against a book that also contains EUR produces a ream of EUR rows whose
// bumps can't move the trade's PV — pure noise in the KRD view.
function swapCurrencies(config: SwapConfig): Set<string> {
  const out = new Set<string>()
  for (const leg of config.legs) {
    if ('currency' in leg) out.add(leg.currency)
    if (leg.legType === 'fx') {
      out.add(leg.baseCurrency)
      out.add(leg.foreignCurrency)
    }
  }
  return out
}

function enumeratePillars(config: SwapConfig, ctx: PricingContext): PillarSelector[] {
  const out: PillarSelector[] = []

  if (ctx.book) {
    const relevant = swapCurrencies(config)
    // Fall back to ctx.curve's currency for leg shapes that don't carry one
    // (CDS protection, asset, underlyings-only) so there's always at least
    // one currency's pillars to enumerate.
    if (relevant.size === 0) relevant.add(ctx.curve.currency)
    for (const [currency, pair] of Object.entries(ctx.book.byCurrency)) {
      if (!relevant.has(currency)) continue
      for (const p of pair.discount.pillars) {
        out.push({ currency, curveType: 'Discount', tenorDays: p.tenorDays })
      }
      for (const proj of Object.values(pair.projections)) {
        for (const p of proj.pillars) {
          out.push({
            currency,
            curveType: 'Projection',
            tenorDays: p.tenorDays,
            indexId: proj.indexId ?? undefined,
          })
        }
      }
    }
    return out
  }

  for (const p of ctx.curve.pillars) {
    out.push({
      currency: ctx.curve.currency,
      curveType: ctx.curve.curveType,
      tenorDays: p.tenorDays,
    })
  }
  return out
}

export function keyRateDv01(config: SwapConfig, ctx: PricingContext): KeyRateDv01Entry[] {
  const selectors = enumeratePillars(config, ctx)
  return selectors.map((sel) => {
    const up = pricingEngine.price(config, bumpPillar(ctx, sel, +BP)).npv
    const down = pricingEngine.price(config, bumpPillar(ctx, sel, -BP)).npv
    return {
      pillarTenorDays: sel.tenorDays,
      currency: sel.currency,
      curveType: sel.curveType,
      indexId: sel.indexId,
      dv01: (up - down) / 2,
    }
  })
}

function bumpProjectionParallel(ctx: PricingContext, bp: number): PricingContext {
  if (!ctx.book) return ctx
  const byCurrency: typeof ctx.book.byCurrency = {}
  for (const [ccy, pair] of Object.entries(ctx.book.byCurrency)) {
    const projections: Record<string, import('../engine/types.js').DiscountCurve> = {}
    for (const [id, proj] of Object.entries(pair.projections)) {
      projections[id] = {
        ...proj,
        pillars: proj.pillars.map((p) => ({ ...p, zeroRate: p.zeroRate + bp })),
      }
    }
    byCurrency[ccy] = { discount: pair.discount, projections }
  }
  return { ...ctx, book: { asOf: ctx.book.asOf, byCurrency } }
}

/**
 * Bumps all projection curves in parallel by 1bp and returns the NPV change.
 * For single-index swaps this is the projection-curve DV01; for multi-index
 * swaps (BASIS, XCCY) it is the sum of sensitivities across all index curves.
 * Use `crossIndexBasisDv01` to isolate sensitivity to a single index.
 */
export function projectionDv01(config: SwapConfig, ctx: PricingContext): number {
  if (!ctx.book) return 0
  const up = pricingEngine.price(config, bumpProjectionParallel(ctx, +BP)).npv
  const down = pricingEngine.price(config, bumpProjectionParallel(ctx, -BP)).npv
  return (up - down) / 2
}

/**
 * @deprecated use projectionDv01
 */
export const basisDv01 = projectionDv01

/**
 * DV01 with respect to a single named projection curve (currency + indexId).
 * For BASIS swaps this isolates the basis risk of one floating leg's index.
 * Returns null when the book doesn't contain the requested (currency, indexId) pair.
 */
export function crossIndexBasisDv01(
  config: SwapConfig,
  ctx: PricingContext,
  currency: string,
  indexId: string,
): number | null {
  if (!ctx.book) return null
  const up = pricingEngine.price(config, bumpSingleProjection(ctx, currency, indexId, +BP)).npv
  const down = pricingEngine.price(config, bumpSingleProjection(ctx, currency, indexId, -BP)).npv
  return (up - down) / 2
}

export function credit01(config: SwapConfig, ctx: PricingContext): number {
  if (config.type !== 'CDS') return 0
  const up = pricingEngine.price(config, bumpCreditSpread(ctx, +BP)).npv
  const down = pricingEngine.price(config, bumpCreditSpread(ctx, -BP)).npv
  return (up - down) / 2
}

export function fxDelta(
  config: SwapConfig,
  ctx: PricingContext,
): { pair: string; delta: number }[] {
  if (!ctx.fxSpots) return []
  const ccys = swapCurrencies(config)
  const RELATIVE = 0.01
  return Object.keys(ctx.fxSpots)
    .filter((pair) => ccys.has(pair.slice(0, 3)) && ccys.has(pair.slice(3, 6)))
    .map((pair) => {
      const up = pricingEngine.price(config, bumpFxSpot(ctx, pair, +RELATIVE)).npv
      const down = pricingEngine.price(config, bumpFxSpot(ctx, pair, -RELATIVE)).npv
      return { pair, delta: (up - down) / 2 }
    })
}
