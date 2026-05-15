import { PartyName } from 'canton-party-directory/ui'
import { LedgerCidLink } from '@/features/ledger/components/ledger-cid-link'
import type { TradeTableColumn } from '@/shared/components/trade-table/types'
import type { OversightRow } from './workflow-to-row'

const STATUS_COLOR: Record<OversightRow['status'], string> = {
  Proposed: 'bg-zinc-800 text-zinc-300',
  Live: 'bg-green-900/40 text-green-300',
  Matured: 'bg-blue-900/40 text-blue-300',
  Terminated: 'bg-red-900/40 text-red-300',
}

// Stable bucket order so header-sort on `status` reads the way a regulator
// expects: Live (active risk) at the top, Terminated at the bottom — not
// the lexicographic L/M/P/T fallback.
const STATUS_ORDER: Record<OversightRow['status'], number> = {
  Live: 0,
  Proposed: 1,
  Matured: 2,
  Terminated: 3,
}

export const OVERSIGHT_COLUMNS: TradeTableColumn<OversightRow>[] = [
  {
    key: 'pair',
    header: 'Pair',
    render: (r) => (
      <div className="flex items-center gap-2">
        <PartyName identifier={r.partyA} />
        <span className="text-zinc-600">↔</span>
        <PartyName identifier={r.partyB} />
      </div>
    ),
    sortBy: (r) => r.partyA,
    sortDirection: 'asc',
  },
  {
    key: 'family',
    header: 'Family',
    render: (r) => r.family,
    sortBy: (r) => r.family,
    sortDirection: 'asc',
  },
  {
    key: 'notional',
    header: 'Notional',
    render: (r) =>
      r.notional === null
        ? '—'
        : `${(r.notional / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`,
    sortBy: (r) => r.notional,
  },
  {
    key: 'currency',
    header: 'Ccy',
    render: (r) => r.currency || '—',
    sortBy: (r) => r.currency || null,
    sortDirection: 'asc',
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <span className={`${STATUS_COLOR[r.status]} px-2 py-0.5 rounded text-xs`}>{r.status}</span>
    ),
    sortBy: (r) => STATUS_ORDER[r.status],
    sortDirection: 'asc',
  },
  { key: 'cid', header: 'CID', render: (r) => <LedgerCidLink cid={r.cid} /> },
]
