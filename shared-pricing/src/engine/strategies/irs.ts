import {
  calcCompoundedCashflow,
  calcFixedCashflows,
  calcFloatCashflows,
  generateScheduleDates,
} from '../cashflows.js'
import { discountFactor } from '../curves.js'
import { yearFraction } from '../day-count.js'
import type {
  CashflowEntry,
  FixedLegConfig,
  FloatLegConfig,
  LegConfig,
  PricingContext,
  PricingStrategy,
} from '../types.js'
import { resolveProjection } from './resolve-projection.js'

const MS_PER_DAY = 86400000
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)

export class IrsPricingStrategy implements PricingStrategy {
  calcLegCashflows(leg: LegConfig, ctx: PricingContext): CashflowEntry[] {
    if (leg.legType === 'fixed') {
      const fl = leg
      return calcFixedCashflows(fl.rate, fl.notional, fl.dayCount, fl.schedule)
    }
    if (leg.legType === 'float') {
      const fl = leg
      // Float-leg forwards come from the leg currency's *projection* curve
      // keyed by the leg's indexId when the book is seeded — independent of
      // the discount curve used for PV. That way a Projection pillar bump
      // actually moves the projected cashflows, which makes key-rate DV01
      // non-zero for projection pillars. Falls back to `ctx.curve` for
      // single-curve callers (no book seeded).
      const projectionCurve = resolveProjection(ctx, fl.currency, fl.indexId)
      // No on-chain index loaded yet: fall back to period-midpoint forward
      // projection (pre-Stage-B behavior). Matches what the blotter sees
      // when useFloatingRateIndex hasn't resolved for a row.
      if (!ctx.index) {
        return calcFloatCashflows(projectionCurve, fl.spread, fl.notional, fl.dayCount, fl.schedule)
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
          curve: projectionCurve,
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
    // IRS is single-currency — discount everything in ctx.curve's currency.
    // Resolve via book when seeded so the currency's discount curve is the
    // single source of truth (and projection-pillar bumps don't accidentally
    // leak into PV via the ctx.curve mirror). Single-curve callers get
    // ctx.curve unchanged.
    const discountCurve = ctx.book?.byCurrency[ctx.curve.currency]?.discount ?? ctx.curve
    const valueDate = new Date(discountCurve.asOf)
    // Skip cashflows on or before the forward-NPV horizon so theta/forwardNpv
    // don't re-price already-settled flows (C1).
    const cutoff = (ctx.valueDate ?? valueDate).getTime()
    return cashflows.reduce((sum, cf) => {
      if (cf.date.getTime() <= cutoff) return sum
      const days = daysBetween(valueDate, cf.date)
      const df = discountFactor(discountCurve, days)
      cf.discountFactor = df
      return sum + cf.amount * df
    }, 0)
  }
}
