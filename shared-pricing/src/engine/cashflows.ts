import { interpolateZero } from './curves.js'
import { yearFraction } from './day-count.js'
import type {
  CashflowEntry,
  DayCountConvention,
  DiscountCurve,
  FloatingRateIndex,
  Frequency,
  PeriodicSchedule,
  RateObservation,
} from './types.js'
import { dayCountBasisForFamily } from './types.js'

const MS_PER_DAY = 86400000
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)

function curveValueDate(curve: DiscountCurve): Date {
  return new Date(curve.asOf)
}

const FREQUENCY_MONTHS: Record<Frequency, number> = {
  Monthly: 1,
  Quarterly: 3,
  SemiAnnual: 6,
  Annual: 12,
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

export function generateScheduleDates(
  startDate: Date,
  endDate: Date,
  frequency: Frequency,
): Date[] {
  const step = FREQUENCY_MONTHS[frequency]
  const dates: Date[] = []
  let current = addMonths(startDate, step)
  while (current <= endDate) {
    dates.push(new Date(current))
    current = addMonths(current, step)
  }
  return dates
}

export function calcFixedCashflows(
  rate: number,
  notional: number,
  dayCount: DayCountConvention,
  schedule: PeriodicSchedule,
): CashflowEntry[] {
  const paymentDates = generateScheduleDates(
    schedule.startDate,
    schedule.endDate,
    schedule.frequency,
  )
  const cashflows: CashflowEntry[] = []
  let periodStart = schedule.startDate
  for (const periodEnd of paymentDates) {
    const yf = yearFraction(periodStart, periodEnd, dayCount)
    cashflows.push({ date: periodEnd, amount: notional * rate * yf })
    periodStart = periodEnd
  }
  return cashflows
}

interface CompoundedInput {
  curve: DiscountCurve
  index: FloatingRateIndex
  /** Observations published between periodStart and periodEnd. Sorted asc; may be empty. */
  observations: RateObservation[]
  periodStart: Date
  periodEnd: Date
  notional: number
}

/**
 * Compounded-in-arrears coupon for an overnight-rate leg (SOFR, ESTR, …).
 *
 * The function iterates the set of `Observation` contracts the oracle has
 * already published for this currency — no off-chain holiday calendar in
 * the pricer. Lookback is applied as a positional shift over the sorted
 * observation list (N publication days back), consistent with the fact that
 * observations only exist on days the rate is actually published.
 *
 * For forward periods (no observation covers `periodEnd`) the tail is
 * projected at the curve's forward rate using simple interest — matches
 * the pre-Stage-B `calcFloatCashflows` behavior for purely forward legs.
 */
export function calcCompoundedCashflow(input: CompoundedInput): number {
  const { curve, index, observations, periodStart, periodEnd, notional } = input
  const basis = dayCountBasisForFamily(index.family)

  const sorted = [...observations].sort((a, b) => a.date.getTime() - b.date.getTime())
  const firstAfter = (t: number) => sorted.findIndex((o) => o.date.getTime() >= t)
  const rawStartIdx = firstAfter(periodStart.getTime())
  const rawEndIdx = firstAfter(periodEnd.getTime())
  const startIdx = rawStartIdx === -1 ? sorted.length : rawStartIdx
  const endIdx = rawEndIdx === -1 ? sorted.length : rawEndIdx
  const shiftedStart = Math.max(0, startIdx - index.lookback)
  const shiftedEnd = Math.max(shiftedStart, endIdx - index.lookback)
  const window = sorted.slice(shiftedStart, shiftedEnd)

  let accrual = 1
  for (let i = 0; i < window.length; i++) {
    const cur = window[i]
    const next = window[i + 1]?.date ?? periodEnd
    const rRaw = cur.rate
    const r = index.floor !== null ? Math.max(rRaw, index.floor) : rRaw
    const tau = Math.round((next.getTime() - cur.date.getTime()) / MS_PER_DAY) / basis
    accrual *= 1 + r * tau
  }

  const lastObsEnd = window.length > 0 ? (sorted[shiftedEnd]?.date ?? periodEnd) : periodStart
  if (lastObsEnd.getTime() < periodEnd.getTime()) {
    const tailStart = window.length > 0 ? lastObsEnd : periodStart
    const tenorDays = Math.max(1, daysBetween(new Date(curve.asOf), tailStart))
    const fwdRate = interpolateZero(curve, tenorDays)
    const tailTau = Math.round((periodEnd.getTime() - tailStart.getTime()) / MS_PER_DAY) / basis
    accrual *= 1 + fwdRate * tailTau
  }

  return notional * (accrual - 1)
}

export function calcFloatCashflows(
  curve: DiscountCurve,
  spread: number,
  notional: number,
  dayCount: DayCountConvention,
  schedule: PeriodicSchedule,
): CashflowEntry[] {
  const paymentDates = generateScheduleDates(
    schedule.startDate,
    schedule.endDate,
    schedule.frequency,
  )
  const cashflows: CashflowEntry[] = []
  const valueDate = curveValueDate(curve)
  let periodStart = schedule.startDate
  for (const periodEnd of paymentDates) {
    const periodMid = new Date((periodStart.getTime() + periodEnd.getTime()) / 2)
    const tenorDays = daysBetween(valueDate, periodMid)
    const forwardRate = interpolateZero(curve, tenorDays)
    const yf = yearFraction(periodStart, periodEnd, dayCount)
    cashflows.push({
      date: periodEnd,
      amount: notional * (forwardRate + spread) * yf,
      projectedRate: forwardRate,
    })
    periodStart = periodEnd
  }
  return cashflows
}
