'use client'

import type { TradeTableProps } from './types'

export function TradeTable<Row>({
  rows,
  columns,
  onRowClick,
  isLoading,
  emptyMessage = 'No rows',
  rowKey,
}: TradeTableProps<Row>) {
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

  if (rows.length === 0) {
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
            {columns.map((c) => (
              <th
                key={c.key}
                className="px-4 py-2.5 text-left font-medium"
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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
