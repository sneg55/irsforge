'use client'

import { useMemo, useState } from 'react'
import type { SortDirection, TradeTableColumn, TradeTableProps, TradeTableSort } from './types'

function compare(av: unknown, bv: unknown): number {
  // Null/undefined sort last regardless of direction — sort callers reverse
  // a "missing" tail rather than have it leak to the top on desc.
  const aMissing = av === null || av === undefined
  const bMissing = bv === null || bv === undefined
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv))
}

function applySort<Row>(
  rows: Row[],
  columns: TradeTableColumn<Row>[],
  sort: TradeTableSort | null,
): Row[] {
  if (!sort) return rows
  const col = columns.find((c) => c.key === sort.key)
  if (!col?.sortBy) return rows
  const sortBy = col.sortBy
  // Decorate–sort–undecorate so each row only computes sortBy once and the
  // original order is preserved for ties.
  const decorated = rows.map((row, i) => ({ row, i, key: sortBy(row) }))
  decorated.sort((a, b) => {
    const c = compare(a.key, b.key)
    if (c !== 0) return sort.direction === 'asc' ? c : -c
    return a.i - b.i
  })
  return decorated.map((d) => d.row)
}

function nextSort(current: TradeTableSort | null, col: TradeTableColumn<unknown>): TradeTableSort {
  if (current?.key !== col.key) {
    return { key: col.key, direction: col.sortDirection ?? 'desc' }
  }
  return { key: col.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

function indicator(active: boolean, direction: SortDirection): string {
  if (!active) return '↕'
  return direction === 'asc' ? '▲' : '▼'
}

export function TradeTable<Row>({
  rows,
  columns,
  onRowClick,
  isLoading,
  emptyMessage = 'No rows',
  rowKey,
  defaultSort,
}: TradeTableProps<Row>) {
  const [sort, setSort] = useState<TradeTableSort | null>(defaultSort ?? null)

  const sortedRows = useMemo(() => applySort(rows, columns, sort), [rows, columns, sort])

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            data-slot="trade-table-skel"
            className="flex items-center gap-4 border-b border-zinc-800/50 px-4 py-3 last:border-b-0"
          >
            {columns.map((c) => (
              <div key={c.key} className="h-3 w-24 rounded bg-zinc-800" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (sortedRows.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-6 py-8 text-center text-sm text-zinc-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-800 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
          <tr>
            {columns.map((c) => {
              const sortable = !!c.sortBy
              const active = sort?.key === c.key
              return (
                <th
                  key={c.key}
                  className="px-4 py-2.5 text-left font-medium"
                  style={c.width ? { width: c.width } : undefined}
                  aria-sort={
                    active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((prev) => nextSort(prev, c as TradeTableColumn<unknown>))
                      }
                      className={`inline-flex items-center gap-1.5 text-left font-medium uppercase tracking-wide ${
                        active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span>{c.header}</span>
                      <span aria-hidden="true" className="text-3xs text-zinc-500">
                        {indicator(active, sort?.direction ?? c.sortDirection ?? 'desc')}
                      </span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-zinc-800/50 last:border-b-0 ${
                onRowClick ? 'cursor-pointer transition-colors hover:bg-zinc-900' : ''
              }`}
            >
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3 text-zinc-300">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
