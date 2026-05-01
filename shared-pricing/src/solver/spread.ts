import { pricingEngine } from '../engine/price.js'
import type { FloatLegConfig, PricingContext, SwapConfig } from '../engine/types.js'
import { solveNewton } from './newton.js'

function withSpread(config: SwapConfig, legIndex: number, spread: number): SwapConfig {
  const legs = config.legs.map((l, i) =>
    i === legIndex ? { ...(l as FloatLegConfig), spread } : l,
  )
  return { ...config, legs }
}

export function solveSpread(config: SwapConfig, ctx: PricingContext, legIndex: number): number {
  if (legIndex < 0 || legIndex >= config.legs.length) {
    throw new Error(`solveSpread: legIndex ${legIndex} out of range`)
  }
  const leg = config.legs[legIndex]
  if (leg.legType !== 'float') {
    throw new Error(`solveSpread: leg ${legIndex} is '${leg.legType}', not 'float'`)
  }

  const f = (s: number) => pricingEngine.price(withSpread(config, legIndex, s), ctx).npv
  const scale = Math.abs(f(0))
  const res = solveNewton(f, 0, { initialStep: 1e-5, scale, bracketMax: 1e5 })
  if (res.root === null) {
    throw new Error(`solveSpread: Newton did not converge (residual=${res.residual})`)
  }
  return res.root
}
