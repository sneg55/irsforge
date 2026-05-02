'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { ErrorState } from '@/components/ui/error-state'
import { LedgerUnreachable } from '@/components/ui/ledger-unreachable'
import { LivenessDot } from '@/components/ui/liveness-dot'
import { NewCsaProposalDialog } from '@/features/operator/components/new-csa-proposal-dialog'
import { useIsOperator, useIsRegulator } from '@/shared/hooks/use-is-operator'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { useLedgerHealth } from '@/shared/hooks/use-ledger-health'
import { computeCallSignal } from './call-amount'
import { CsaDrawer } from './components/csa-drawer'
import { CsaPageSkeleton } from './components/csa-page-skeleton'
import { CsaProposalsTable } from './components/csa-proposals-table'
import { CsaRow } from './components/csa-row'
import { type CsaViewModel, pairKey } from './decode'
import { useCsaProposals } from './hooks/use-csa-proposals'
import { useCsas } from './hooks/use-csas'
import { useMarkStream } from './hooks/use-mark-stream'

const COLUMNS: { key: string; label: string; align?: 'right' }[] = [
  { key: 'pair', label: 'Pair' },
  { key: 'exposure', label: 'Exposure', align: 'right' },
  { key: 'call', label: 'Call / Return', align: 'right' },
  { key: 'posted', label: 'Posted', align: 'right' },
  { key: 'threshold', label: 'Threshold', align: 'right' },
  { key: 'mta', label: 'MTA', align: 'right' },
  { key: 'rounding', label: 'Rounding', align: 'right' },
  { key: 'state', label: 'State' },
]

type CsaTab = 'active' | 'proposals'
const VALID_TABS = new Set<CsaTab>(['active', 'proposals'])

export function CsaPage() {
  const { activeParty } = useLedgerClient()
  const isOperator = useIsOperator()
  const isRegulator = useIsRegulator()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ledgerHealth = useLedgerHealth()
  const { data: csas, isLoading, isFetching, error, refetch } = useCsas()
  const { proposals } = useCsaProposals()
  const [openPair, setOpenPair] = useState<string | null>(null)
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false)

  const urlTab = searchParams.get('tab') as CsaTab | null
  const [activeTab, setActiveTab] = useState<CsaTab>(
    urlTab && VALID_TABS.has(urlTab) ? urlTab : 'active',
  )
  const handleTabChange = (tab: CsaTab) => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'active') params.delete('tab')
    else params.set('tab', tab)
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  if (isLoading) {
    return <CsaPageSkeleton />
  }
  // Distinguish "ledger is down" from generic query errors. With the
  // placeholderData: keepPreviousData default, csas/proposals retain
  // their last successful snapshot through transient outages — keep
  // showing that table (status-bar pill already conveys "Canton
  // unreachable"). Only when there is genuinely nothing to fall back on
  // do we replace the table with the friendly LedgerUnreachable panel.
  // A non-ledger error (auth, schema mismatch, etc.) still surfaces via
  // the existing ErrorState with a retry button.
  const noCachedData = csas.length === 0 && proposals.length === 0
  if (ledgerHealth === 'down' && noCachedData) {
    return <LedgerUnreachable message="Your CSA portfolio is unavailable right now." />
  }
  if (ledgerHealth === 'reconnecting' && noCachedData) {
    return <LedgerUnreachable message="Reconnecting your CSA portfolio after a demo restart." />
  }
  if (error && noCachedData) {
    return <ErrorState error={error} onRetry={refetch} />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold text-white tracking-tight">Credit Support Annexes</h1>
          <LivenessDot
            state={isFetching ? 'stale' : 'live'}
            title={isFetching ? 'Refreshing…' : 'Up to date'}
          />
        </div>
        {!isOperator && !isRegulator && (
          <button
            type="button"
            data-testid="new-csa-proposal-button"
            className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
            onClick={() => setProposalDialogOpen(true)}
          >
            New CSA proposal
          </button>
        )}
      </div>
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <div className="flex items-center border-b border-zinc-800 bg-zinc-900">
          <CsaTabButton
            tab="active"
            label="Active"
            count={csas.length}
            active={activeTab === 'active'}
            onClick={() => handleTabChange('active')}
          />
          <CsaTabButton
            tab="proposals"
            label="Proposals"
            count={proposals.length}
            active={activeTab === 'proposals'}
            onClick={() => handleTabChange('proposals')}
            highlight
          />
        </div>
        {activeTab === 'active' ? (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/50">
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={`px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csas.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-zinc-500">
                    No CSAs visible to active party.
                  </td>
                </tr>
              ) : (
                csas.map((c) => {
                  const key = pairKey(c.partyA, c.partyB)
                  return (
                    <CsaRowWithStream
                      key={key}
                      csa={c}
                      expanded={openPair === key}
                      onToggle={() => setOpenPair(openPair === key ? null : key)}
                      activeParty={activeParty ?? ''}
                    />
                  )
                })
              )}
            </tbody>
          </table>
        ) : proposals.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            No CSA proposals awaiting your response.
          </div>
        ) : (
          <CsaProposalsTable rows={proposals} />
        )}
      </div>
      <NewCsaProposalDialog
        open={proposalDialogOpen}
        onClose={() => setProposalDialogOpen(false)}
      />
    </div>
  )
}

interface TabButtonProps {
  tab: CsaTab
  label: string
  count: number
  active: boolean
  onClick: () => void
  highlight?: boolean
}

function CsaTabButton({ tab, label, count, active, onClick, highlight }: TabButtonProps) {
  const isInbox = highlight && count > 0
  return (
    <button
      type="button"
      data-testid={`csa-tab-${tab}`}
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium transition-colors ${
        active ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {label}
      {isInbox ? (
        <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 font-mono text-2xs font-semibold text-white">
          {count}
        </span>
      ) : (
        <span
          className={`ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-2xs font-medium ${
            active ? 'bg-blue-500/15 text-blue-300' : 'bg-zinc-800 text-zinc-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

interface RowWithStreamProps {
  csa: CsaViewModel
  expanded: boolean
  onToggle: () => void
  activeParty: string
}

function CsaRowWithStream({ csa, expanded, onToggle, activeParty }: RowWithStreamProps) {
  const { latest } = useMarkStream(csa.partyA, csa.partyB)
  const callSignal = latest ? computeCallSignal(csa, latest.exposure) : null
  return (
    <>
      <CsaRow
        csa={csa}
        expanded={expanded}
        onToggle={onToggle}
        latestExposure={latest?.exposure ?? null}
        callSignal={callSignal}
      />
      {expanded && (
        <tr className="bg-zinc-900/70 border-b border-zinc-800">
          <td colSpan={COLUMNS.length} className="p-0">
            <CsaDrawer csa={csa} activeParty={activeParty} />
          </td>
        </tr>
      )}
    </>
  )
}
