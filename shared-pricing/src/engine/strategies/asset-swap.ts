import {
  calcCompoundedCashflow,
  calcFixedCashflows,
  calcFloatCashflows,
  generateScheduleDates,
} from '../cashflows.js'
import { discountFactor } from '../curves.js'
import { yearFraction } from '../day-count.js'
import type {
  AssetLegConfig,
  CashflowEntry,
  FixedLegConfig,
  FloatLegConfig,
  LegConfig,
  PricingContext,
  PricingStrategy,
} from '../types.js'

const MS_PER_DAY = 86400000
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)

/**
 * Asset Swap Pricing Strategy
 *
 * Asset leg: single cashflow at the last curve tenor date equal to
 *   notional × Σ(weight × (currentPrice - initialPrice) / initialPrice)
 *
 * Rate leg (fixed or float): delegates to shared cashflow generators, same as IRS.
 * PV for all leg types: standard discount-factor summation.
 */
export class AssetSwapPricingStrategy implements PricingStrategy {
  calcLegCashflows(leg: LegConfig, ctx: PricingContext): CashflowEntry[] {
    if (leg.legType === 'asset') {
      const al = leg
      const weightedReturn = al.underlyings.reduce(
        (acc, u) => acc + (u.weight * (u.currentPrice - u.initialPrice)) / u.initialPrice,
        0,
      )
      const lastTenorDays = ctx.curve.pillars[ctx.curve.pillars.length - 1]?.tenorDays ?? 365
      const valueDate = new Date(ctx.curve.asOf)
      const maturityDate = new Date(valueDate.getTime() + lastTenorDays * MS_PER_DAY)
      return [{ date: maturityDate, amount: al.notional * weightedReturn }]
    }

    if (leg.legType === 'fixed') {
      const fl = leg
      return calcFixedCashflows(fl.rate, fl.notional, fl.dayCount, fl.schedule)
    }

    if (leg.legType === 'float') {
      const fl = leg
      if (!ctx.index) {
        return calcFloatCashflows(ctx.curve, fl.spread, fl.notional, fl.dayCount, fl.schedule)
      }
      const dates = generateScheduleDates(
        fl.schedule.startDate,
        fl.schedule.endDate,
        fl.schedule.frequency,
      )
      const out: CashflowEntry[] = []
      let periodStart = fl.schedule.startDate
      for (const periodEnd of dates) {
        const amount = calcCompoundedCashflow({
          curve: ctx.curve,
          index: ctx.index,
          observations: ctx.observations,
          periodStart,
          periodEnd,
          notional: fl.notional,
        })
        const yf = yearFraction(periodStart, periodEnd, fl.dayCount)
        const projectedRate = yf > 0 ? amount / fl.notional / yf : 0
        out.push({ date: periodEnd, amount, projectedRate })
        periodStart = periodEnd
      }
      return out
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
