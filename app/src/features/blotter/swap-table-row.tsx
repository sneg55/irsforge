'use client'

import { PartyName } from 'canton-party-directory/ui'
import { Sparkline } from '../workspace/components/sparkline'
import { SWAP_TYPE_CONFIGS } from '../workspace/constants'
import { statusCodeFor } from './status-code'
import { formatNotional, formatNpv, TYPE_BADGE_COLORS } from './swap-table-helpers'
import type { BlotterTab, SwapRow } from './types'

interface SwapTableRowProps {
  row: SwapRow
  activeTab: BlotterTab
  isTerminal: boolean
  isDrafts: boolean
  onClick: () => void
  onDeleteDraft: (id: string) => void
}

/**
 * Compute a hover label for the sparkline cell. Buyers expect to see the
 * horizon and the magnitude of the swing — without this the sparkline is
 * decorative and unanchored to a scale.
 */
function sparklineTooltip(values: number[]): string | undefined {
  if (values.length < 2) return undefined
  const min = Math.min(...values)
  const max = Math.max(...values)
  const last = values[values.length - 1] ?? 0
  const denom = Math.abs(last) > 1 ? Math.abs(last) : Math.max(Math.abs(min), Math.abs(max), 1)
  const swingPct = ((max - min) / denom) * 100
  return `Trend over last ${values.length} curve ticks · range ±${swingPct.toFixed(1)}%`
}

function signedAmountClass(n: number | null | undefined): string {
  if (n == null) return 'text-zinc-600'
  return n >= 0 ? 'text-green-400' : 'text-red-400'
}

function AlertCell({ row }: { row: SwapRow }) {
  if (!row.pendingUnwind) return <td className="w-3 px-1 py-3" />
  const isCpty = row.pendingUnwind.role === 'counterparty'
  return (
    <td className="w-3 px-1 py-3">
      <span
        title={
          isCpty
            ? 'Unwind proposed — your action required'
            : 'Unwind proposed — awaiting counterparty'
        }
        className={`inline-block h-1.5 w-1.5 rounded-full ${isCpty ? 'bg-red-500' : 'bg-amber-400'}`}
      />
    </td>
  )
}

function StatusCell({ row, activeTab }: { row: SwapRow; activeTab: BlotterTab }) {
  const { code, colorClass } = statusCodeFor(activeTab, row.status)
  const showMatSoon = row.maturingSoon && row.status === 'Active'
  return (
    <td className="px-4 py-3">
      <span className={`font-mono text-[10px] font-medium ${colorClass}`}>{code}</span>
      {showMatSoon && (
        <span
          title="Maturing within 7 days"
          className="ml-1 inline-block font-mono text-[9px] font-semibold text-amber-400"
        >
          MAT SOON
        </span>
      )}
    </td>
  )
}

function TerminalCells({ row }: { row: SwapRow }) {
  const amt = row.terminalAmount
  return (
    <>
      <td className="px-4 py-3 text-zinc-300">{row.terminalDate ?? '—'}</td>
      <td className={`px-4 py-3 text-right font-mono ${signedAmountClass(amt)}`}>
        {amt !== undefined ? formatNpv(amt) : '—'}
      </td>
    </>
  )
}

function ActiveCells({ row }: { row: SwapRow }) {
  return (
    <>
      <td className={`px-4 py-3 text-right font-mono ${signedAmountClass(row.npv)}`}>
        {formatNpv(row.npv)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-zinc-300">
        {row.dv01 !== null ? formatNotional(row.dv01) : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex justify-end">
          <Sparkline
            values={row.sparkline ?? []}
            stroke={row.npv !== null && row.npv >= 0 ? '#4ade80' : '#f87171'}
            tooltip={sparklineTooltip(row.sparkline ?? [])}
          />
        </div>
      </td>
    </>
  )
}

function DirectionCell({ row }: { row: SwapRow }) {
  const isPay = row.direction === 'pay'
  return (
    <td className="px-4 py-3">
      <div className="leading-tight">
        <span className={`font-medium ${isPay ? 'text-red-400' : 'text-green-400'}`}>
          {isPay ? 'Pay' : 'Receive'}
        </span>
        {row.legDetail && (
          <div className="font-mono text-[10px] text-zinc-500">{row.legDetail}</div>
        )}
      </div>
    </td>
  )
}

export function SwapTableRow({
  row,
  activeTab,
  isTerminal,
  isDrafts,
  onClick,
  onDeleteDraft,
}: SwapTableRowProps) {
  const typeConfig = SWAP_TYPE_CONFIGS[row.type]
  const badgeClass = TYPE_BADGE_COLORS[row.type] ?? 'bg-zinc-500/20 text-zinc-400'
  const rowClass = row.status === 'Draft' ? 'opacity-60 italic' : ''

  return (
    <tr
      key={row.contractId}
      onClick={onClick}
      className={`cursor-pointer border-b border-zinc-800/50 bg-zinc-950 hover:bg-zinc-900 transition-colors ${rowClass}`}
    >
      <AlertCell row={row} />
      <td className="px-4 py-3">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeClass}`}>
          {typeConfig?.shortLabel ?? row.type}
        </span>
      </td>
      <StatusCell row={row} activeTab={activeTab} />
      <td className="px-4 py-3 text-white">
        <PartyName identifier={row.counterparty} />
      </td>
      <td className="px-4 py-3 text-right font-mono text-zinc-300">
        {formatNotional(row.notional)}
      </td>
      <td className="px-4 py-3 text-zinc-300">{row.currency}</td>
      <td className="px-4 py-3 text-zinc-300">{row.tradeDate}</td>
      <td className="px-4 py-3 text-zinc-300">{row.maturity}</td>
      {isTerminal ? <TerminalCells row={row} /> : <ActiveCells row={row} />}
      <DirectionCell row={row} />
      {isDrafts && (
        <td className="px-4 py-3 text-right">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDeleteDraft(row.contractId)
            }}
            className="text-zinc-600 hover:text-red-400 text-xs transition-colors"
          >
            Delete
          </button>
        </td>
      )}
    </tr>
  )
}

export { sparklineTooltip }
