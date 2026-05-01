import { pricingEngine } from '../engine/price.js'
import type { FixedLegConfig, PricingContext, SwapConfig } from '../engine/types.js'
import { solveNewton } from './newton.js'

function withFixedRate(config: SwapConfig, fixedLegIdx: number, rate: number): SwapConfig {
  const legs = config.legs.map((l, i) =>
    i === fixedLegIdx ? { ...(l as FixedLegConfig), rate } : l,
  )
  return { ...config, legs }
}

export function solveParRate(config: SwapConfig, ctx: PricingContext): number {
  const fixedLegIdx = config.legs.findIndex((l) => l.legType === 'fixed')
  if (fixedLegIdx < 0) throw new Error('solveParRate: no fixed leg in swap')

  const closed = pricingEngine.price(config, ctx).parRate
  if (closed !== null && Number.isFinite(closed)) return closed

  const f = (r: number) => pricingEngine.price(withFixedRate(config, fixedLegIdx, r), ctx).npv
  const scale = Math.abs(f(0.04))
  const res = solveNewton(f, 0.04, { initialStep: 1e-5, scale })
  if (res.root === null) {
    throw new Error(`solveParRate: Newton did not converge (residual=${res.residual})`)
  }
  return res.root
}
