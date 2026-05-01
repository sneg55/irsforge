import { WORKSPACE_COLORS } from '../constants'
import type { CashflowEntry, LegConfig } from '../types'

export function computeAccrued(cashflows: CashflowEntry[], leg: LegConfig): number {
  if (cashflows.length === 0) return 0
  const now = new Date()
  const pastCfs = cashflows.filter((cf) => cf.date <= now)
  const futureCfs = cashflows.filter((cf) => cf.date > now)
  if (futureCfs.length === 0) return 0
  const periodStart =
    pastCfs.length > 0
      ? pastCfs[pastCfs.length - 1].date
      : 'schedule' in leg
        ? leg.schedule.startDate
        : now
  const periodEnd = futureCfs[0].date
  const totalDays = (periodEnd.getTime() - periodStart.getTime()) / 86400000
  const elapsedDays = (now.getTime() - periodStart.getTime()) / 86400000
  if (totalDays <= 0) return 0
  return futureCfs[0].amount * (elapsedDays / totalDays)
}

export function getLegLabel(leg: LegConfig, index: number): string {
  const num = index + 1
  const dir = leg.direction === 'pay' ? 'PAY' : 'RCV'
  switch (leg.legType) {
    case 'fixed':
      return `LEG ${num} — ${dir} FIXED`
    case 'float':
      return `LEG ${num} — ${dir} FLOAT`
    case 'protection':
      return `LEG ${num} — ${leg.direction === 'pay' ? 'SELL' : 'BUY'} PROTECTION`
    case 'asset':
      return `LEG ${num} — ${dir} ASSET`
    case 'fx': {
      const nearFar = index === 0 ? 'NEAR' : 'FAR'
      const dirLabel = leg.direction === 'pay' ? 'PAY' : 'RCV'
      return `LEG ${num} — FX ${nearFar} (${dirLabel})`
    }
    default:
      return `LEG ${num}`
  }
}

export function getAccentColor(index: number): string {
  return index === 0 ? WORKSPACE_COLORS.green : WORKSPACE_COLORS.red
}
