'use client'

import { usePartyDirectory } from 'canton-party-directory/react'
import { useMemo, useState } from 'react'
import { TradeTable } from '@/shared/components/trade-table/trade-table'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { type SwapFamily, useSwapInstruments } from '@/shared/hooks/use-swap-instruments'
import { useAllProposalsCrossOrg } from '../hooks/use-all-proposals-cross-org'
import { useAllSwapWorkflows } from '../hooks/use-all-swap-workflows'
import { OVERSIGHT_COLUMNS } from './columns'
import {
  maturedToRow,
  type OversightRow,
  proposalToRow,
  terminatedToRow,
  workflowToRow,
} from './workflow-to-row'

type StatusFilter = 'all' | 'live' | 'proposed' | 'terminal'

export function OversightPage() {
  const { client } = useLedgerClient()
  const wf = useAllSwapWorkflows()
  const props = useAllProposalsCrossOrg()
  const { displayName } = usePartyDirectory()
  const [pairFilter, setPairFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Match the blotter pattern: fetch only the instrument families on screen.
  const families = useMemo<SwapFamily[]>(() => {
    const set = new Set<SwapFamily>()
    for (const w of wf.workflows) set.add(w.payload.swapType as SwapFamily)
    for (const c of wf.matured) set.add(c.payload.swapType as SwapFamily)
    for (const c of wf.terminated) set.add(c.payload.swapType as SwapFamily)
    return Array.from(set)
  }, [wf.workflows, wf.matured, wf.terminated])

  const { byInstrumentId } = useSwapInstruments(client, families)

  const rows = useMemo<OversightRow[]>(() => {
    return [
      ...wf.workflows.map((c) => workflowToRow(c, byInstrumentId)),
      ...props.proposals.map(proposalToRow),
      ...wf.matured.map((c) => maturedToRow(c, byInstrumentId)),
      ...wf.terminated.map((c) => terminatedToRow(c, byInstrumentId)),
    ]
  }, [wf.workflows, wf.matured, wf.terminated, props.proposals, byInstrumentId])

  const filtered = useMemo<OversightRow[]>(() => {
    return rows.filter((r) => {
      if (statusFilter === 'live' && r.status !== 'Live') return false
      if (statusFilter === 'proposed' && r.status !== 'Proposed') return false
      if (statusFilter === 'terminal' && r.status !== 'Matured' && r.status !== 'Terminated') {
        return false
      }
      if (pairFilter) {
        const needle = pairFilter.toLowerCase()
        const hay =
          `${r.partyA} ${r.partyB} ${displayName(r.partyA)} ${displayName(r.partyB)}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [rows, statusFilter, pairFilter, displayName])

  const isLoading = wf.isLoading || props.isLoading

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white tracking-tight">Oversight</h1>
        <p className="text-xs text-zinc-500">
          {filtered.length} of {rows.length} trades
        </p>
      </header>
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Filter by counterparty…"
          value={pairFilter}
          onChange={(e) => setPairFilter(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-white placeholder:text-zinc-500"
        />
        <div className="flex gap-1 text-xs">
          {(['all', 'live', 'proposed', 'terminal'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`filter-${s}`}
              onClick={() => setStatusFilter(s)}
              className={`rounded px-3 py-1.5 ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <TradeTable
        rows={filtered}
        columns={OVERSIGHT_COLUMNS}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        emptyMessage={
          statusFilter === 'all' && !pairFilter ? 'No trades yet.' : 'No trades match the filter.'
        }
      />
    </div>
  )
}
