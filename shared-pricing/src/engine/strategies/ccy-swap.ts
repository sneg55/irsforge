import { calcFixedCashflows } from '../cashflows.js'
import { discountFactor } from '../curves.js'
import type {
  CashflowEntry,
  FixedLegConfig,
  LegConfig,
  PricingContext,
  PricingStrategy,
} from '../types.js'

const MS_PER_DAY = 86400000
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)

/**
 * CCY Swap Pricing Strategy
 *
 * Both legs are fixed-rate. Each is discounted with the same curve (simplified —
 * production would use separate curves per currency). The notional difference
 * between legs implicitly captures the FX effect.
 */
export class CcySwapPricingStrategy implements PricingStrategy {
  calcLegCashflows(leg: LegConfig, _ctx: PricingContext): CashflowEntry[] {
    if (leg.legType !== 'fixed') return []
    const fl = leg
    return calcFixedCashflows(fl.rate, fl.notional, fl.dayCount, fl.schedule)
  }

  calcLegPV(cashflows: CashflowEntry[], ctx: PricingContext): number {
    const valueDate = new Date(ctx.curve.asOf)
    const cutoff = (ctx.valueDate ?? valueDate).getTime()
    return cashflows.reduce((sum, cf) => {
      if (cf.date.getTime() <= cutoff) return sum
      const days = daysBetween(valueDate, cf.date)
      const df = discountFactor(ctx.curve, days)
      return sum + cf.amount * df
    }, 0)
  }
}
