import type { LegConfig, SwapType } from '../types'
import type { WorkspaceDates } from '../utils/date-recalc'
import { computeTenor } from '../utils/tenor-parser'

// Shared helpers for hydrate-workflow-legs.ts. Kept separate so the per-
// family hydrator file stays under the 300-line limit.

type DayCountOut = 'ACT_360' | 'ACT_365' | 'THIRTY_360' | 'THIRTY_E_360'

const DAML_TO_UI_DAYCOUNT: Record<string, DayCountOut> = {
  Act360: 'ACT_360',
  Act365Fixed: 'ACT_365',
  Basis30360: 'THIRTY_360',
  Basis30E360: 'THIRTY_E_360',
}

export function dayCount(raw: unknown): DayCountOut {
  return DAML_TO_UI_DAYCOUNT[String(raw)] ?? 'ACT_360'
}

export function num(raw: unknown, fallback = 0): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
  return Number.isFinite(n) ? n : fallback
}

export function parseDate(raw: unknown): Date {
  const s = String(raw ?? '')
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d)
}

export function buildDates(effective: Date, termination: Date): WorkspaceDates {
  return {
    tradeDate: new Date(effective),
    effectiveDate: effective,
    maturityDate: termination,
    tenor: computeTenor(effective, termination),
    anchor: 'tenor',
    effManuallySet: false,
  }
}

export interface HydratedWorkflow {
  swapType: SwapType
  legs: LegConfig[]
  dates: WorkspaceDates
}
