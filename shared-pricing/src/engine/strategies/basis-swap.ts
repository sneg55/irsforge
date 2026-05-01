import { calcCompoundedCashflow, calcFloatCashflows, generateScheduleDates } from '../cashflows.js'
import { discountFactor } from '../curves.js'
import { yearFraction } from '../day-count.js'
import type {
  CashflowEntry,
  FloatLegConfig,
  LegConfig,
  PricingContext,
  PricingStrategy,
} from '../types.js'
import { resolveProjection } from './resolve-projection.js'

const MS_PER_DAY = 86400000
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)

// Basis swap: two floating legs, single currency, two different
// FloatingRateIndex contracts. Each leg's compounded-in-arrears coupon is
// computed against its own index via `ctx.indicesByLeg[legIndex]`, falling
// back to `ctx.index` (single-index compatibility) and then to simple
// forward projection when no index is loaded for a leg.
export class BasisSwapPricingStrategy implements PricingStrategy {
  calcLegCashflows(leg: LegConfig, ctx: PricingContext, legIndex = 0): CashflowEntry[] {
    if (leg.legType !== 'float') return []
    const fl = leg
    const index = ctx.indicesByLeg?.[legIndex] ?? ctx.index
    // Resolve the projection curve by (currency, leg indexId) so per-index
    // projection bumps (e.g. bumping SOFR projection without touching EFFR)
    // route correctly. Falls back to first projection then ctx.curve for
    // single-curve callers (no book seeded).
    const projectionCurve = resolveProjection(ctx, fl.currency, fl.indexId)
    if (!index) {
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
      const compounded = calcCompoundedCashflow({
        curve: projectionCurve,
        index,
        observations: ctx.observations,
        periodStart,
        periodEnd,
        notional: fl.notional,
      })
      const yf = yearFraction(periodStart, periodEnd, fl.dayCount)
      const spreadCf = fl.spread * fl.notional * yf
      const amount = compounded + spreadCf
      const projectedRate = yf > 0 ? amount / fl.notional / yf : 0
      out.push({ date: periodEnd, amount, projectedRate })
      periodStart = periodEnd
    }
    return out
  }

  calcLegPV(cashflows: CashflowEntry[], ctx: PricingContext): number {
    // Same pattern as IRS: resolve off the book when seeded so the
    // currency's discount curve is the single source of truth and a
    // projection-pillar bump doesn't leak into PV via `ctx.curve`. Single-
    // curve callers (no book) keep the old behavior unchanged.
    const discountCurve = ctx.book?.byCurrency[ctx.curve.currency]?.discount ?? ctx.curve
    const valueDate = new Date(discountCurve.asOf)
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
