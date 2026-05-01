import { generateScheduleDates } from '../engine/cashflows.js'
import { fxFactor } from '../engine/fx.js'
import { getStrategy, pricingEngine } from '../engine/price.js'
import type {
  CurveBook,
  DiscountCurve,
  FixedLegConfig,
  FloatLegConfig,
  FxLegConfig,
  LegConfig,
  PeriodicSchedule,
  PricingContext,
  SwapConfig,
} from '../engine/types.js'

const MS_PER_DAY = 86400000

export type Horizon =
  | { kind: 'toTimestamp'; asOf: string }
  | { kind: 'deltaSeconds'; seconds: number }
  | { kind: 'toNextEvent'; event: 'fixing' | 'payment' }

function legSchedule(leg: LegConfig): PeriodicSchedule | null {
  if (leg.legType === 'fixed' || leg.legType === 'float') {
    return leg.schedule
  }
  return null
}

function legCurrency(leg: LegConfig): string | null {
  if ('currency' in leg) return leg.currency
  if ('baseCurrency' in leg) return leg.baseCurrency
  return null
}

function nextEvent(
  config: SwapConfig,
  ctx: PricingContext,
  evt: 'fixing' | 'payment',
): Date | null {
  const t0 = new Date(ctx.curve.asOf).getTime()
  const candidates: number[] = []
  for (const leg of config.legs) {
    const sched = legSchedule(leg)
    if (sched) {
      if (evt === 'fixing' && leg.legType !== 'float') continue
      const ends = generateScheduleDates(sched.startDate, sched.endDate, sched.frequency)
      for (const d of ends) {
        if (d.getTime() > t0) {
          candidates.push(d.getTime())
          break
        }
      }
      continue
    }
    if (leg.legType === 'fx' && evt === 'payment') {
      const d = leg.paymentDate.getTime()
      if (d > t0) candidates.push(d)
    }
  }
  if (candidates.length === 0) {
    if (evt === 'fixing') return nextEvent(config, ctx, 'payment')
    return null
  }
  return new Date(Math.min(...candidates))
}

export function resolveHorizon(config: SwapConfig, ctx: PricingContext, h: Horizon): string {
  const t0 = new Date(ctx.curve.asOf).getTime()
  if (h.kind === 'toTimestamp') {
    const t1 = new Date(h.asOf).getTime()
    if (!(t1 > t0))
      throw new Error(`resolveHorizon: target asOf must be strictly after ${ctx.curve.asOf}`)
    return h.asOf
  }
  if (h.kind === 'deltaSeconds') {
    if (!(h.seconds > 0)) throw new Error(`resolveHorizon: deltaSeconds must be positive`)
    return new Date(t0 + h.seconds * 1000).toISOString()
  }
  const next = nextEvent(config, ctx, h.event)
  if (!next) throw new Error(`resolveHorizon: no ${h.event} event after ${ctx.curve.asOf}`)
  return next.toISOString()
}

function shiftCurve(
  c: DiscountCurve,
  targetAsOf: string,
  deltaDays: number,
  mode: 'slide' | 'freeze',
): DiscountCurve {
  const pillars =
    mode === 'freeze'
      ? c.pillars.map((p) => ({ ...p, tenorDays: Math.max(1, p.tenorDays - deltaDays) }))
      : c.pillars
  return { ...c, asOf: targetAsOf, pillars }
}

export function advanceAsOf(
  ctx: PricingContext,
  targetAsOf: string,
  mode: 'slide' | 'freeze',
): PricingContext {
  const t0 = new Date(ctx.curve.asOf).getTime()
  const t1 = new Date(targetAsOf).getTime()
  if (t1 < t0)
    throw new Error(`advanceAsOf: target ${targetAsOf} is before current ${ctx.curve.asOf}`)
  const deltaDays = Math.round((t1 - t0) / MS_PER_DAY)

  const curve = shiftCurve(ctx.curve, targetAsOf, deltaDays, mode)
  let book: CurveBook | undefined = ctx.book
  if (book) {
    const byCurrency: CurveBook['byCurrency'] = {}
    for (const [ccy, pair] of Object.entries(book.byCurrency)) {
      const projections: typeof pair.projections = {}
      for (const [id, proj] of Object.entries(pair.projections)) {
        projections[id] = shiftCurve(proj, targetAsOf, deltaDays, mode)
      }
      byCurrency[ccy] = {
        discount: shiftCurve(pair.discount, targetAsOf, deltaDays, mode),
        projections,
      }
    }
    book = { asOf: targetAsOf, byCurrency }
  }
  return { ...ctx, curve, book }
}

function priceStrictlyFuture(config: SwapConfig, ctx: PricingContext, strictAsOf: string): number {
  // Set valueDate so each strategy's calcLegPV drops cashflows on or before
  // the horizon, then delegate to the engine for the signed, direction-aware
  // sum. This way the pay/receive sign from each leg is correctly applied and
  // settled cashflows (including XCCY initial exchange) are excluded uniformly.
  const ctxWithCutoff: PricingContext = { ...ctx, valueDate: new Date(strictAsOf) }
  return pricingEngine.price(config, ctxWithCutoff).npv
}

function cashflowsBetween(
  config: SwapConfig,
  ctx: PricingContext,
  t0Str: string,
  t1Str: string,
): number {
  const strategy = getStrategy(config.type)
  const reportingCcy = ctx.reportingCcy ?? legCurrency(config.legs[0]) ?? 'USD'
  const t0 = new Date(t0Str).getTime()
  const t1 = new Date(t1Str).getTime()
  let total = 0
  for (let i = 0; i < config.legs.length; i++) {
    const leg = config.legs[i]
    for (const cf of strategy.calcLegCashflows(leg, ctx, i)) {
      const d = cf.date.getTime()
      if (d <= t0 || d > t1) continue
      const cfCcy = cf.currency ?? legCurrency(leg) ?? reportingCcy
      if (cfCcy === reportingCcy) total += cf.amount
      else total += cf.amount * fxFactor(cfCcy, reportingCcy, ctx.fxSpots ?? {})
    }
  }
  return total
}

export function theta(config: SwapConfig, ctx: PricingContext, horizon: Horizon): number {
  const t1 = resolveHorizon(config, ctx, horizon)
  // Price T0 with the same settled-cashflow filter that priceStrictlyFuture
  // applies, so both sides exclude same-day settlement flows (XCCY initial
  // exchange). valueDate = asOf means "skip cashflows on or before today".
  const ctxWithValueDate: PricingContext = { ...ctx, valueDate: new Date(ctx.curve.asOf) }
  const npvT0 = pricingEngine.price(config, ctxWithValueDate).npv
  const advFreeze = advanceAsOf(ctxWithValueDate, t1, 'freeze')
  return priceStrictlyFuture(config, advFreeze, t1) - npvT0
}

export function carry(config: SwapConfig, ctx: PricingContext, horizon: Horizon): number {
  const t1 = resolveHorizon(config, ctx, horizon)
  return cashflowsBetween(config, ctx, ctx.curve.asOf, t1)
}

export function roll(config: SwapConfig, ctx: PricingContext, horizon: Horizon): number {
  const t1 = resolveHorizon(config, ctx, horizon)
  const advFreeze = advanceAsOf(ctx, t1, 'freeze')
  const advSlide = advanceAsOf(ctx, t1, 'slide')
  return priceStrictlyFuture(config, advSlide, t1) - priceStrictlyFuture(config, advFreeze, t1)
}

export function forwardNpv(config: SwapConfig, ctx: PricingContext, asOf: string): number {
  const t0 = new Date(ctx.curve.asOf).getTime()
  const t1 = new Date(asOf).getTime()
  if (t1 < t0) throw new Error(`forwardNpv: asOf ${asOf} is before current ${ctx.curve.asOf}`)
  // Apply the same settled-cashflow filter as theta so NPV(t0) + theta + roll = forwardNpv(t1).
  const ctxFiltered: PricingContext = { ...ctx, valueDate: new Date(ctx.curve.asOf) }
  const advanced = advanceAsOf(ctxFiltered, asOf, 'slide')
  return priceStrictlyFuture(config, advanced, asOf)
}
