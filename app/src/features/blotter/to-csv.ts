import type { SwapRow } from './types'

const HEADERS = [
  'contractId',
  'type',
  'status',
  'counterparty',
  'notional',
  'currency',
  'tradeDate',
  'maturity',
  'npv',
  'dv01',
  'direction',
  'legDetail',
] as const

function escapeCell(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  // Quote fields that contain a comma, quote, or newline; double internal
  // quotes per RFC 4180.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Render an array of blotter rows as RFC 4180 CSV text. The header order
 * is fixed so downstream sheets/recon scripts can rely on column position
 * regardless of which tab the user exported from. Pure; no DOM access.
 */
export function rowsToCsv(rows: readonly SwapRow[]): string {
  const lines: string[] = [HEADERS.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.contractId,
        r.type,
        r.status,
        r.counterparty,
        r.notional,
        r.currency,
        r.tradeDate,
        r.maturity,
        r.npv,
        r.dv01,
        r.direction,
        r.legDetail,
      ]
        .map(escapeCell)
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

/**
 * Trigger a browser download of the supplied rows. Caller passes a tab
 * name so the filename reads as `blotter-active-2026-04-27.csv`. No-op
 * outside the browser (SSR / unit-test) so callers can wire the click
 * handler unconditionally.
 */
export function downloadRowsAsCsv(rows: readonly SwapRow[], tabName: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const csv = rowsToCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const isoDate = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `blotter-${tabName}-${isoDate}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
