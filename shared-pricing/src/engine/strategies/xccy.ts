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
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  LegConfig,
  PricingContext,
  PricingStrategy,
} from '../types.js'
import { resolveProjection } from './resolve-projection.js'

const MS_PER_DAY = 86400000
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)

// Cross-currency fixed-float swap. Each leg carries its own currency and
// picks its own discount + projection curve off `ctx.book`. Principal
// exchanges at start and maturity are priced as notional-sized cashflows
// on the leg's own schedule; every cashflow is tagged with its leg
// currency so `calcLegPV` picks the right discount curve without
// knowing leg order. The engine later translates each leg's PV to the
// reporting currency via `ctx.fxSpots`.
export class XccyFixedFloatPricingStrategy implements PricingStrategy {
  calcLegCashflows(leg: LegConfig, ctx: PricingContext, legIndex = 0): CashflowEntry[] {
    if (leg.legType !== 'fixed' && leg.legType !== 'float') return []
    const ccy = leg.currency
    // Validates the book is seeded with curves for this currency.
    assertCcyInBook(ctx, ccy)
    const notional = leg.notional
    const schedule = leg.schedule

    const floatLeg = leg as FloatLegConfig
    const coupons: CashflowEntry[] =
      leg.legType === 'fixed'
        ? calcFixedCashflows(leg.rate, notional, leg.dayCount, schedule)
        : floatCoupons(
            resolveProjection(ctx, ccy, floatLeg.indexId),
            floatLeg,
            ctx.observations,
            ctx.indicesByLeg?.[legIndex] ?? ctx.index,
          )

    const principal: CashflowEntry[] = [
      { date: schedule.startDate, amount: -notional },
      { date: schedule.endDate, amount: notional },
    ]

    const all = [...principal, ...coupons].map((cf) => ({ ...cf, currency: ccy }))
    return all.sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  calcLegPV(cashflows: CashflowEntry[], ctx: PricingContext): number {
    if (cashflows.length === 0) return 0
    if (!ctx.book) throw new Error('XCCY pricing requires a CurveBook on PricingContext')
    const ccy = cashflows[0].currency
    if (!ccy) throw new Error('XCCY cashflows must carry `currency`; strategy did not tag them')
    const curves = ctx.book.byCurrency[ccy]
    if (!curves) throw new Error(`XCCY PV: no curves seeded for ${ccy}`)
    const valueDate = new Date(curves.discount.asOf)
    const cutoff = (ctx.valueDate ?? valueDate).getTime()
    return cashflows.reduce((sum, cf) => {
      if (cf.date.getTime() <= cutoff) return sum
      const days = daysBetween(valueDate, cf.date)
      const df = discountFactor(curves.discount, days)
      cf.discountFactor = df
      return sum + cf.amount * df
    }, 0)
  }
}

function assertCcyInBook(ctx: PricingContext, ccy: string): void {
  if (!ctx.book) throw new Error('XCCY pricing requires a CurveBook on PricingContext')
  if (!ctx.book.byCurrency[ccy]) throw new Error(`XCCY: no curves seeded for ${ccy}`)
}

function floatCoupons(
  projection: DiscountCurve,
  fl: FloatLegConfig,
  observations: PricingContext['observations'],
  index: FloatingRateIndex | null,
): CashflowEntry[] {
  if (!index) {
    return calcFloatCashflows(projection, fl.spread, fl.notional, fl.dayCount, fl.schedule)
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
      curve: projection,
      index,
      observations,
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
