import { generateScheduleDates } from '../engine/cashflows.js'
import { yearFraction } from '../engine/day-count.js'
import { fxFactor } from '../engine/fx.js'
import { getStrategy, pricingEngine } from '../engine/price.js'
import type {
  FixedLegConfig,
  FloatLegConfig,
  FxLegConfig,
  LegConfig,
  PricingContext,
  SwapConfig,
  SwapType,
} from '../engine/types.js'

function legSchedule(leg: LegConfig) {
  if (leg.legType === 'fixed' || leg.legType === 'float') {
    return leg.schedule
  }
  return null
}

function legDayCount(leg: LegConfig) {
  if (leg.legType === 'fixed' || leg.legType === 'float') {
    return leg.dayCount
  }
  return 'ACT_360' as const
}

/**
 * Families whose periodic cashflows genuinely accrue linearly between
 * coupon dates. FX/CCY/ASSET/FpML are out by design: FX is a single-event
 * settlement; the others don't expose a coupon-accrual schedule in the
 * shape this helper walks. The engine registers strategies for them (so
 * `getStrategy` would succeed) — this allow-list is the intent guard.
 */
const ACCRUAL_FAMILIES: ReadonlySet<SwapType> = new Set<SwapType>([
  'IRS',
  'OIS',
  'BASIS',
  'XCCY',
  'CDS',
])

function legCurrency(leg: LegConfig): string | null {
  if ('currency' in leg) return leg.currency
  if ('baseCurrency' in leg) return leg.baseCurrency
  return null
}

export function accrued(config: SwapConfig, ctx: PricingContext, asOf?: string): number {
  if (!ACCRUAL_FAMILIES.has(config.type)) return 0
  const strategy = getStrategy(config.type)

  const target = new Date(asOf ?? ctx.curve.asOf)
  const reportingCcy = ctx.reportingCcy ?? legCurrency(config.legs[0]) ?? 'USD'

  let total = 0
  for (let i = 0; i < config.legs.length; i++) {
    const leg = config.legs[i]

    if (leg.legType === 'protection' || leg.legType === 'asset' || leg.legType === 'fx') continue

    const sched = legSchedule(leg)
    if (!sched) continue

    if (target < sched.startDate || target >= sched.endDate) continue

    const dayCount = legDayCount(leg)
    const periodEnds = generateScheduleDates(sched.startDate, sched.endDate, sched.frequency)

    let periodStart = sched.startDate
    let periodEnd: Date | null = null
    for (const e of periodEnds) {
      if (target < e) {
        periodEnd = e
        break
      }
      periodStart = e
    }
    if (!periodEnd) continue

    // Compute this leg's cashflow for the active period via the strategy.
    const cashflows = strategy.calcLegCashflows(leg, ctx, i)
    const legCcy = legCurrency(leg) ?? reportingCcy
    const notional = Math.abs(leg.notional)

    // Pick the coupon whose date === periodEnd and whose amount is NOT the
    // principal-exchange lump (which XCCY tags onto the schedule endpoints).
    const activeCf = cashflows.find((cf) => {
      if (cf.date.getTime() !== periodEnd?.getTime()) return false
      if (cf.currency && cf.currency !== legCcy) return false
      // Principal exchange: amount equals ±notional on schedule start/end.
      const isPrincipalExchange =
        (cf.date.getTime() === sched.startDate.getTime() ||
          cf.date.getTime() === sched.endDate.getTime()) &&
        Math.abs(Math.abs(cf.amount) - notional) < 1e-6
      return !isPrincipalExchange
    })
    if (!activeCf) continue

    const totalPeriodYf = yearFraction(periodStart, periodEnd, dayCount)
    if (totalPeriodYf <= 0) continue
    const elapsedYf = yearFraction(periodStart, target, dayCount)
    const fraction = Math.max(0, Math.min(1, elapsedYf / totalPeriodYf))

    const accrualLocal = activeCf.amount * fraction

    if (config.type === 'XCCY' && legCcy !== reportingCcy) {
      total += accrualLocal * fxFactor(legCcy, reportingCcy, ctx.fxSpots ?? {})
    } else {
      total += accrualLocal
    }
  }

  return total
}

export function dirty(config: SwapConfig, ctx: PricingContext): number {
  return pricingEngine.price(config, ctx).npv
}

export function clean(config: SwapConfig, ctx: PricingContext): number {
  return dirty(config, ctx) - accrued(config, ctx)
}
