'use client'

import { useQuery } from '@tanstack/react-query'
import { PartyName } from 'canton-party-directory/ui'
import { useRouter } from 'next/navigation'
import { useMemo, useReducer, useState } from 'react'
import { LedgerUnreachable } from '@/components/ui/ledger-unreachable'
import { useCsaSummary } from '@/features/csa/hooks/use-csa-summary'
import { useIsOperator, useIsRegulator } from '@/shared/hooks/use-is-operator'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { useLedgerHealth } from '@/shared/hooks/use-ledger-health'
import { useOracleCurve } from '@/shared/hooks/use-oracle-curve'
import type { SwapFamily } from '@/shared/hooks/use-swap-instruments'
import { useSwapInstruments } from '@/shared/hooks/use-swap-instruments'
import { pollIntervalWithBackoff } from '@/shared/ledger/poll-interval'
import type {
  ContractResult,
  MaturedSwap,
  SwapWorkflow,
  TerminatedSwap,
} from '@/shared/ledger/types'
import { useCurveBook } from '@/shared/ledger/useCurveBook'
import { useCurveStream } from '@/shared/ledger/useCurveStream'
import { useFxSpots } from '@/shared/ledger/useFxSpots'
import { useDrafts } from '../workspace/hooks/use-drafts'
import { deriveBlotterViewModel } from './derive-view-model'
import { ExposureHeader, ExposureHeaderSkeleton } from './exposure-header'
import { useAllProposals } from './hooks/use-all-proposals'
import { useBlotterUrlState } from './hooks/use-blotter-url-state'
import { useBlotterValuation } from './hooks/use-blotter-valuation'
import { useTerminateProposals } from './hooks/use-terminate-proposals'
import { RowDetailsDrawer } from './row-details-drawer'
import { SwapTable } from './swap-table'
import { downloadRowsAsCsv } from './to-csv'
import type { SwapRow } from './types'
import { workflowToRow } from './workflow-to-row'

// Re-export so existing test imports (`from '../page'`) keep working.
export { workflowToRow }

const POLL_HEALTHY_MS = 3_000

// Back off the 3 s blotter polls to the shared default (30 s) once the
// ledger errors — see `@/shared/ledger/poll-interval` for the rationale
// and call shape. The historical local copy lived here briefly before
// being lifted to a shared helper used by every refetching query.
const blotterPollInterval = pollIntervalWithBackoff(POLL_HEALTHY_MS)

export function Blotter() {
  const { client, activeParty } = useLedgerClient()
  const router = useRouter()
  const isOperator = useIsOperator()
  const isRegulator = useIsRegulator()
  const ledgerHealth = useLedgerHealth()
  const { listDrafts, deleteDraft, deleteAllDrafts } = useDrafts()
  const [, forceUpdate] = useReducer((x) => x + 1, 0)
  const [drawerRow, setDrawerRow] = useState<SwapRow | null>(null)

  const {
    activeTab,
    handleTabChange,
    counterpartyHint,
    clearCounterpartyFilter,
    workspaceBase,
    csaBase,
  } = useBlotterUrlState()

  const workflowsQuery = useQuery<ContractResult<SwapWorkflow>[]>({
    queryKey: ['workflows', activeParty],
    queryFn: async () => {
      if (!client) return []
      return await client.query<ContractResult<SwapWorkflow>>('Swap.Workflow:SwapWorkflow')
    },
    enabled: !!client,
    refetchInterval: blotterPollInterval,
  })
  const workflows = workflowsQuery.data ?? []

  const maturedQuery = useQuery<ContractResult<MaturedSwap>[]>({
    queryKey: ['matured', activeParty],
    queryFn: async () => {
      if (!client) return []
      return await client.query<ContractResult<MaturedSwap>>('Swap.Workflow:MaturedSwap')
    },
    enabled: !!client,
    refetchInterval: blotterPollInterval,
  })
  const maturedContracts = maturedQuery.data ?? []

  const terminatedQuery = useQuery<ContractResult<TerminatedSwap>[]>({
    queryKey: ['terminated', activeParty],
    queryFn: async () => {
      if (!client) return []
      return await client.query<ContractResult<TerminatedSwap>>('Swap.Terminate:TerminatedSwap')
    },
    enabled: !!client,
    refetchInterval: blotterPollInterval,
  })
  const terminatedContracts = terminatedQuery.data ?? []

  // Derive the set of swap families currently on screen so we fetch only the
  // instrument templates we actually need.
  const families = useMemo(() => {
    const set = new Set<SwapFamily>()
    for (const w of workflows) set.add(w.payload.swapType as SwapFamily)
    for (const c of maturedContracts) set.add(c.payload.swapType as SwapFamily)
    for (const c of terminatedContracts) set.add(c.payload.swapType as SwapFamily)
    return Array.from(set)
  }, [workflows, maturedContracts, terminatedContracts])

  const { byInstrumentId } = useSwapInstruments(client, families)

  const { proposalRows, isLoading: proposalsLoading } = useAllProposals()
  const terminateProposals = useTerminateProposals()
  const csaSummary = useCsaSummary(activeParty)
  const { data: curveBook } = useCurveBook()
  const { data: fxSpots } = useFxSpots()
  const { curve } = useOracleCurve()
  const curveStream = useCurveStream('USD', 'Discount')
  const curveHistory = useMemo(() => curveStream.history.map((e) => e.curve), [curveStream.history])
  const valuations = useBlotterValuation(
    workflows,
    byInstrumentId,
    curve,
    curveBook ?? null,
    fxSpots ?? {},
    curveHistory,
  )

  // `isPending` is true ONLY on the very first fetch, so refetches don't
  // flip the page back to skeleton state. The previous OR-chain on
  // `isLoading` (alias for `isPending` per query) was already initial-only,
  // but combining four queries' independent `isPending` flags meant the
  // table re-rendered each time any one resolved — visible as the table
  // "jumping" while ledger is healthy. We still gate on every query so the
  // exposure header doesn't render with partial data, but using `isPending`
  // explicitly keeps the contract clear.
  const isInitialLoading =
    workflowsQuery.isPending ||
    proposalsLoading ||
    maturedQuery.isPending ||
    terminatedQuery.isPending

  // Decide whether to show the "Ledger unreachable" empty state instead of
  // an empty SwapTable. Triggers only when health is genuinely `down` AND
  // none of the workflows/matured/terminated queries ever produced data
  // for the current session — otherwise we keep showing the last
  // successful snapshot (placeholderData: keepPreviousData) with the
  // status-bar dot communicating the degraded state.
  const noCachedRows =
    workflows.length === 0 && maturedContracts.length === 0 && terminatedContracts.length === 0
  const showLedgerUnreachable = ledgerHealth === 'down' && noCachedRows

  // activeParty from AuthState is already the party hint (PartyA/PartyB) used for on-chain matching
  const { currentRows, exposureHeaderData, tabCounts } = deriveBlotterViewModel({
    workflows,
    maturedContracts,
    terminatedContracts,
    proposalRows,
    drafts: listDrafts(),
    partyHint: activeParty ?? '',
    counterpartyHint,
    csaSummary,
    valuations,
    byInstrumentId,
    terminateProposals,
    curve: curve ?? null,
    activeTab,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-white tracking-tight">Trade Blotter</h1>
          {counterpartyHint && (
            <button
              type="button"
              data-testid="counterparty-filter-pill"
              onClick={clearCounterpartyFilter}
              title="Clear counterparty filter"
              className="rounded-full border border-blue-700/50 bg-blue-900/30 px-2.5 py-0.5 text-xs text-blue-200 hover:bg-blue-900/60"
            >
              cpty: <PartyName identifier={counterpartyHint} />{' '}
              <span className="text-blue-300/80">×</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isOperator && !isRegulator && (
            <button
              data-testid="new-swap-btn"
              onClick={() => router.push(workspaceBase)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              New Swap
            </button>
          )}
        </div>
      </div>
      {isInitialLoading ? (
        <ExposureHeaderSkeleton />
      ) : (
        <ExposureHeader data={exposureHeaderData} csaHref={csaBase} />
      )}
      {showLedgerUnreachable ? (
        <LedgerUnreachable message="Your swap blotter is unavailable right now." />
      ) : (
        <SwapTable
          rows={currentRows as SwapRow[]}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabCounts={tabCounts}
          onDeleteDraft={(id) => {
            deleteDraft(id)
            forceUpdate()
          }}
          onDeleteAllDrafts={() => {
            deleteAllDrafts()
            forceUpdate()
          }}
          workspaceBase={workspaceBase}
          isLoading={isInitialLoading}
          onOpenDetails={setDrawerRow}
          onExportCsv={() => downloadRowsAsCsv(currentRows as SwapRow[], activeTab)}
          exportDisabled={currentRows.length === 0}
        />
      )}
      <RowDetailsDrawer row={drawerRow} onClose={() => setDrawerRow(null)} />
    </div>
  )
}
