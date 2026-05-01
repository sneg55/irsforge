import { pricingEngine } from '../engine/price.js'
import type { PricingContext, SwapConfig } from '../engine/types.js'

export function solveUnwindPv(config: SwapConfig, ctx: PricingContext): number {
  return pricingEngine.price(config, ctx).npv
}
