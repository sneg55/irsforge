import type {
  CashflowEntry,
  LegConfig,
  PricingContext,
  PricingStrategy,
  SwapConfig,
} from '../types.js'
import { AssetSwapPricingStrategy } from './asset-swap.js'
import { CdsPricingStrategy } from './cds.js'
import { FxSwapPricingStrategy } from './fx-swap.js'
import { IrsPricingStrategy } from './irs.js'

// Reuse existing strategies by leg type
const delegateStrategies: Record<string, PricingStrategy> = {
  fixed: new IrsPricingStrategy(),
  float: new IrsPricingStrategy(),
  protection: new CdsPricingStrategy(),
  fx: new FxSwapPricingStrategy(),
  asset: new AssetSwapPricingStrategy(),
}

export class FpmlPricingStrategy implements PricingStrategy {
  calcLegCashflows(
    leg: LegConfig,
    ctx: PricingContext,
    legIndex?: number,
    config?: SwapConfig,
  ): CashflowEntry[] {
    const delegate = delegateStrategies[leg.legType]
    if (!delegate) return []
    return delegate.calcLegCashflows(leg, ctx, legIndex, config)
  }

  calcLegPV(cashflows: CashflowEntry[], ctx: PricingContext): number {
    const irsStrategy = delegateStrategies['fixed']
    return irsStrategy.calcLegPV(cashflows, ctx)
  }
}
