'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { getColumnsForTab, PAGE_SIZE } from './constants'
import { EMPTY_MESSAGES, type SortState, sortRows, TAB_CONFIG } from './swap-table-helpers'
import { SwapTableRow } from './swap-table-row'
import { SkeletonRow } from './swap-table-skeleton-row'
import type { BlotterTab, SwapRow } from './types'

interface SwapTableProps {
  rows: SwapRow[]
  activeTab: BlotterTab
  onTabChange: (tab: BlotterTab) => void
  tabCounts: Record<BlotterTab, number>
  onDeleteDraft: (draftId: string) => void
  onDeleteAllDrafts?: () => void
  workspaceBase: string
  isLoading?: boolean
  onOpenDetails: (row: SwapRow) => void
  onExportCsv?: () => void
  exportDisabled?: boolean
}

export function SwapTable({
  rows,
  activeTab,
  onTabChange,
  tabCounts,
  onDeleteDraft,
  onDeleteAllDrafts,
  workspaceBase,
  isLoading,
  onOpenDetails,
  onExportCsv,
  exportDisabled,
}: SwapTableProps) {
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<SortState | null>(null)
  const columns = getColumnsForTab(activeTab)
  const isDrafts = activeTab === 'drafts'
  const isTerminal = activeTab === 'matured' || activeTab === 'unwound'
  const sortedRows = useMemo(() => sortRows(rows, sort, columns), [rows, sort, columns])
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const pageRows = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleTabChange = (tab: BlotterTab) => {
    setPage(0)
    setSort(null)
    onTabChange(tab)
  }

  const handleHeaderClick = (key: string) => {
    setPage(0)
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const handleRowClick = (row: SwapRow) => {
    if (row.status === 'Matured' || row.status === 'Unwound') {
      onOpenDetails(row)
      return
    }
    if (row.status === 'Draft') {
      router.push(`${workspaceBase}?draft=${row.contractId}`)
    } else {
      router.push(`${workspaceBase}?swap=${row.contractId}`)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center border-b border-zinc-800 bg-zinc-900">
        {TAB_CONFIG.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            suppressHydrationWarning
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {label}
            {isLoading && key !== 'drafts' ? (
              <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-500">
                …
              </span>
            ) : key === 'proposals' && tabCounts[key] > 0 ? (
              <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
                {tabCounts[key]}
              </span>
            ) : (
              <span
                className={`ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[11px] font-medium ${
                  activeTab === key ? 'bg-blue-500/15 text-blue-300' : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {tabCounts[key]}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto mr-3 flex items-center gap-3">
          {isDrafts && rows.length > 0 && onDeleteAllDrafts && (
            <button
              onClick={onDeleteAllDrafts}
              className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
            >
              Delete All
            </button>
          )}
          {onExportCsv && (
            <button
              type="button"
              data-testid="export-csv-btn"
              onClick={onExportCsv}
              disabled={exportDisabled}
              title="Export the current tab to CSV"
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="border-b border-zinc-800 bg-zinc-900/50">
          <tr>
            <th className="w-3 px-1 py-3" aria-label="Alert" />
            {columns.map((col) => {
              const sortable = !!col.sortAccessor
              const isActive = sort?.key === col.key
              const indicator = isActive ? (sort?.dir === 'asc' ? ' ↑' : ' ↓') : ''
              return (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400 ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  } ${sortable ? 'cursor-pointer select-none hover:text-zinc-200' : ''}`}
                  onClick={sortable ? () => handleHeaderClick(col.key) : undefined}
                  title={sortable ? 'Click to sort' : undefined}
                >
                  {col.label}
                  {indicator && <span className="text-blue-400 ml-1">{indicator}</span>}
                </th>
              )
            })}
            {isDrafts && (
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400 text-right">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }, (_, i) => (
              <SkeletonRow key={i} columnCount={columns.length + (isDrafts ? 1 : 0)} />
            ))
          ) : pageRows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (isDrafts ? 1 : 0) + 1}
                className="px-4 py-8 text-center text-zinc-500"
              >
                {EMPTY_MESSAGES[activeTab]}
              </td>
            </tr>
          ) : (
            pageRows.map((row) => (
              <SwapTableRow
                key={row.contractId}
                row={row}
                activeTab={activeTab}
                isTerminal={isTerminal}
                isDrafts={isDrafts}
                onClick={() => handleRowClick(row)}
                onDeleteDraft={onDeleteDraft}
              />
            ))
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 bg-zinc-900/50">
          <span className="text-xs text-zinc-500">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, rows.length)} of{' '}
            {rows.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              &lt;
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`px-2 py-1 text-xs rounded ${
                  page === i
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
