import type { BlotterTab, SwapRow } from './types'

export const STATUS_COLORS: Record<string, string> = {
  Proposed: 'text-yellow-400',
  Active: 'text-green-400',
  Draft: 'text-zinc-500',
  Matured: 'text-blue-400',
  Unwound: 'text-zinc-400',
}

export interface ColumnDef {
  key: string
  label: string
  align: 'left' | 'right'
  /** When set, the column is sortable. Maps a row to a comparable scalar.
   *  Returning `null` / `undefined` sorts those rows to the end regardless
   *  of direction. */
  sortAccessor?: (row: SwapRow) => string | number | null | undefined
}

const BASE_COLUMNS: readonly ColumnDef[] = [
  { key: 'type', label: 'Type', align: 'left', sortAccessor: (r) => r.type },
  { key: 'status', label: 'Status', align: 'left', sortAccessor: (r) => r.status },
  { key: 'counterparty', label: 'Cpty', align: 'left', sortAccessor: (r) => r.counterparty },
  { key: 'notional', label: 'Notional', align: 'right', sortAccessor: (r) => r.notional },
  { key: 'currency', label: 'CCY', align: 'left', sortAccessor: (r) => r.currency },
  { key: 'tradeDate', label: 'Trade', align: 'left', sortAccessor: (r) => r.tradeDate },
  { key: 'maturity', label: 'Maturity', align: 'left', sortAccessor: (r) => r.maturity },
]

const ACTIVE_TAIL: readonly ColumnDef[] = [
  { key: 'npv', label: 'NPV', align: 'right', sortAccessor: (r) => r.npv },
  { key: 'dv01', label: 'DV01', align: 'right', sortAccessor: (r) => r.dv01 },
  { key: 'sparkline', label: 'Trend', align: 'right' },
  { key: 'direction', label: 'Direction', align: 'left', sortAccessor: (r) => r.direction },
]

const MATURED_TAIL: readonly ColumnDef[] = [
  { key: 'terminalDate', label: 'Actual Mat', align: 'left', sortAccessor: (r) => r.terminalDate },
  {
    key: 'terminalAmount',
    label: 'Final Net',
    align: 'right',
    sortAccessor: (r) => r.terminalAmount,
  },
  { key: 'direction', label: 'Direction', align: 'left', sortAccessor: (r) => r.direction },
]

const UNWOUND_TAIL: readonly ColumnDef[] = [
  { key: 'terminalDate', label: 'Term Date', align: 'left', sortAccessor: (r) => r.terminalDate },
  {
    key: 'terminalAmount',
    label: 'Agreed PV',
    align: 'right',
    sortAccessor: (r) => r.terminalAmount,
  },
  { key: 'direction', label: 'Direction', align: 'left', sortAccessor: (r) => r.direction },
]

export function getColumnsForTab(tab: BlotterTab): readonly ColumnDef[] {
  switch (tab) {
    case 'matured':
      return [...BASE_COLUMNS, ...MATURED_TAIL]
    case 'unwound':
      return [...BASE_COLUMNS, ...UNWOUND_TAIL]
    case 'active':
    case 'proposals':
    case 'drafts':
      return [...BASE_COLUMNS, ...ACTIVE_TAIL]
  }
}

// Kept for any legacy imports; identical to active tail.
export const BLOTTER_COLUMNS = getColumnsForTab('active')

export const PAGE_SIZE = 10
