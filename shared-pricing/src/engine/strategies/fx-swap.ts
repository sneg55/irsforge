import { discountFactor } from '../curves.js'
import type {
  CashflowEntry,
  FxLegConfig,
  LegConfig,
  PricingContext,
  PricingStrategy,
} from '../types.js'

const MS_PER_DAY = 86400000
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)

/**
 * FX Swap Pricing Strategy
 *
 * Each leg (near or far) produces a single cashflow: notional × fxRate.
 * The sign convention (pay vs receive) is handled at the orchestrator level via
 * sign on notional or fxRate — the strategy itself always returns a positive amount.
 * PV is computed by discounting the single cashflow back to the curve value date.
 */
export class FxSwapPricingStrategy implements PricingStrategy {
  calcLegCashflows(leg: LegConfig, _ctx: PricingContext): CashflowEntry[] {
    if (leg.legType !== 'fx') return []
    const fl = leg
    return [{ date: fl.paymentDate, amount: fl.notional * fl.fxRate }]
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
