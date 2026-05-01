import { bumpParallel } from '../engine/bump-parallel.js'
import { pricingEngine } from '../engine/price.js'
import type { PricingContext, SwapConfig } from '../engine/types.js'
import { basisDv01, keyRateDv01 } from '../risk/metrics.js'

export type HedgeObjective = 'dv01' | 'basisDv01' | 'keyRate'

const BP = 0.0001

function anchorNotional(config: SwapConfig): number {
  const leg0 = config.legs[0]
  const n = 'notional' in leg0 ? leg0.notional : 0
  if (n === 0) throw new Error('solveHedgeNotional: hedge leg-0 notional is 0; cannot anchor')
  return n
}

function signedParallelDv01(config: SwapConfig, ctx: PricingContext): number {
  const up = pricingEngine.price(config, bumpParallel(ctx, +BP)).npv
  const down = pricingEngine.price(config, bumpParallel(ctx, -BP)).npv
  return (up - down) / 2
}

function measure(
  config: SwapConfig,
  ctx: PricingContext,
  objective: HedgeObjective,
  pillarTenorDays?: number,
): number {
  if (objective === 'dv01') return signedParallelDv01(config, ctx)
  if (objective === 'basisDv01') return basisDv01(config, ctx)
  if (pillarTenorDays === undefined) {
    throw new Error(`solveHedgeNotional: objective='keyRate' requires pillarTenorDays`)
  }
  const entry = keyRateDv01(config, ctx).find((e) => e.pillarTenorDays === pillarTenorDays)
  if (!entry) {
    throw new Error(`solveHedgeNotional: no KRD pillar at tenorDays=${pillarTenorDays}`)
  }
  return entry.dv01
}

export function solveHedgeNotional(
  targetConfig: SwapConfig,
  targetCtx: PricingContext,
  hedgeConfig: SwapConfig,
  hedgeCtx: PricingContext,
  objective: HedgeObjective,
  pillarTenorDays?: number,
): number {
  const mTarget = measure(targetConfig, targetCtx, objective, pillarTenorDays)
  const mHedge = measure(hedgeConfig, hedgeCtx, objective, pillarTenorDays)
  if (mHedge === 0 || !Number.isFinite(mHedge)) {
    throw new Error(`solveHedgeNotional: hedge measure is ${mHedge}; cannot invert`)
  }
  const factor = -mTarget / mHedge
  return factor * anchorNotional(hedgeConfig)
}
