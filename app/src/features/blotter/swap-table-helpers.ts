import type { ColumnDef } from './constants'
import type { BlotterTab, SwapRow } from './types'

export type SortDir = 'asc' | 'desc'
export interface SortState {
  key: string
  dir: SortDir
}

/**
 * Returns a new array with rows sorted by `state.key` using the column's
 * `sortAccessor`. Rows whose accessor returns null/undefined are pushed to
 * the end regardless of direction so a click on a half-populated column
 * doesn't bury the rows that have data. Mutating-free; the caller may
 * pass a frozen rows array.
 */
export function sortRows(
  rows: readonly SwapRow[],
  state: SortState | null,
  columns: readonly ColumnDef[],
): SwapRow[] {
  const out = rows.slice()
  if (!state) return out
  const col = columns.find((c) => c.key === state.key)
  if (!col?.sortAccessor) return out
  const access = col.sortAccessor
  const sign = state.dir === 'asc' ? 1 : -1
  out.sort((a, b) => {
    const av = access(a)
    const bv = access(b)
    const aMissing = av == null
    const bMissing = bv == null
    if (aMissing && bMissing) return 0
    if (aMissing) return 1
    if (bMissing) return -1
    if (typeof av === 'number' && typeof bv === 'number') return sign * (av - bv)
    return sign * String(av).localeCompare(String(bv))
  })
  return out
}

export const TYPE_BADGE_COLORS: Record<string, string> = {
  IRS: 'bg-blue-500/20 text-blue-400',
  OIS: 'bg-sky-500/20 text-sky-400',
  BASIS: 'bg-indigo-500/20 text-indigo-400',
  XCCY: 'bg-teal-500/20 text-teal-400',
  CDS: 'bg-red-500/20 text-red-400',
  CCY: 'bg-purple-500/20 text-purple-400',
  FX: 'bg-green-500/20 text-green-400',
  ASSET: 'bg-amber-500/20 text-amber-400',
  FpML: 'bg-zinc-500/20 text-zinc-400',
}

export const TAB_CONFIG: { key: BlotterTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'proposals', label: 'Proposals' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'matured', label: 'Matured' },
  { key: 'unwound', label: 'Unwound' },
]

export const EMPTY_MESSAGES: Record<BlotterTab, string> = {
  active: 'No active swaps. Accept a proposal to get started.',
  proposals: 'No pending proposals.',
  drafts: 'No drafts. Create a new swap to start.',
  matured: 'No matured swaps yet.',
  unwound: 'No unwound swaps yet.',
}

export function formatNotional(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function formatNpv(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
