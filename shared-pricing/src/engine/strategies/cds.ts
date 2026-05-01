import { calcFixedCashflows } from '../cashflows.js'
import { discountFactor } from '../curves.js'
import { DEFAULT_CREDIT_SPREAD } from '../defaults.js'
import type {
  CashflowEntry,
  FixedLegConfig,
  LegConfig,
  PricingContext,
  PricingStrategy,
  ProtectionLegConfig,
  SwapConfig,
} from '../types.js'

// Re-exported for back-compat: existing imports like
// `import { DEFAULT_CREDIT_SPREAD } from '.../strategies/cds.js'` keep working,
// but the single source of truth now lives in `engine/defaults.ts`.
export { DEFAULT_CREDIT_SPREAD }

const MS_PER_DAY = 86400000

const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)

export class CdsPricingStrategy implements PricingStrategy {
  calcLegCashflows(
    leg: LegConfig,
    ctx: PricingContext,
    legIndex = 0,
    config?: SwapConfig,
  ): CashflowEntry[] {
    const hazard = ctx.creditSpread ?? DEFAULT_CREDIT_SPREAD
    const valueDate = new Date(ctx.curve.asOf)

    if (leg.legType === 'fixed') {
      const fl = leg
      const baseCashflows = calcFixedCashflows(fl.rate, fl.notional, fl.dayCount, fl.schedule)
      return baseCashflows.map((cf) => {
        const days = daysBetween(valueDate, cf.date)
        const sp = Math.exp(-hazard * (days / 365))
        return { ...cf, amount: cf.amount * sp }
      })
    }

    if (leg.legType === 'protection') {
      const pl = leg
      const maturity = config?.maturityDate ?? new Date(valueDate.getTime() + 365 * MS_PER_DAY)
      const years = Math.max(0, (maturity.getTime() - valueDate.getTime()) / (365 * MS_PER_DAY))
      const defaultProbability = 1 - Math.exp(-hazard * years)
      const amount = pl.notional * (1 - pl.recoveryRate) * defaultProbability
      return [{ date: maturity, amount }]
    }

    return []
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
