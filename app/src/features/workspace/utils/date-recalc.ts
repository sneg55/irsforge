import type { Tenor } from './tenor-parser'
import { addTenor, computeTenor } from './tenor-parser'

export type DateAnchor = 'trade' | 'effective' | 'maturity' | 'tenor'

export interface WorkspaceDates {
  tradeDate: Date
  effectiveDate: Date
  maturityDate: Date
  tenor: Tenor
  anchor: DateAnchor
  effManuallySet: boolean
}

export function recalculateDates(
  current: WorkspaceDates,
  changed: DateAnchor,
  newValue: Date | Tenor,
): WorkspaceDates {
  const next = { ...current, anchor: changed }

  switch (changed) {
    case 'tenor': {
      const tenor = newValue as Tenor
      next.tenor = tenor
      next.maturityDate = addTenor(next.effectiveDate, tenor)
      break
    }

    case 'maturity': {
      const mat = newValue as Date
      next.maturityDate = mat
      next.tenor = computeTenor(next.effectiveDate, mat)
      break
    }

    case 'effective': {
      const eff = newValue as Date
      next.effectiveDate = eff
      next.maturityDate = addTenor(eff, next.tenor)
      next.effManuallySet = eff.getTime() !== next.tradeDate.getTime()
      break
    }

    case 'trade': {
      const trade = newValue as Date
      next.tradeDate = trade
      if (!current.effManuallySet) {
        next.effectiveDate = new Date(trade)
        next.maturityDate = addTenor(next.effectiveDate, next.tenor)
      }
      break
    }
  }

  return next
}

export function validateDates(dates: WorkspaceDates): string | null {
  if (dates.effectiveDate.getTime() < dates.tradeDate.getTime()) {
    return 'Effective date must be >= Trade date'
  }
  if (dates.maturityDate.getTime() <= dates.effectiveDate.getTime()) {
    return 'Maturity date must be > Effective date'
  }
  return null
}

export function buildDefaultWorkspaceDates(): WorkspaceDates {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tenor: Tenor = { years: 5, months: 0 }
  return {
    tradeDate: today,
    effectiveDate: new Date(today),
    maturityDate: addTenor(today, tenor),
    tenor,
    anchor: 'tenor',
    effManuallySet: false,
  }
}
