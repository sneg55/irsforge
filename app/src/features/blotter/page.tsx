'use client'

import { useQuery } from '@tanstack/react-query'
import { PartyName } from 'canton-party-directory/ui'
import { useRouter } from 'next/navigation'
import { useMemo, useReducer, useState } from 'react'
import { useCsaSummary } from '@/features/csa/hooks/use-csa-summary'
import { useIsOperator, useIsRegulator } from '@/shared/hooks/use-is-operator'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { useOracleCurve } from '@/shared/hooks/use-oracle-curve'
import type { SwapFamily } from '@/shared/hooks/use-swap-instruments'
import { useSwapInstruments } from '@/shared/hooks/use-swap-instruments'
import { partyMatchesHint } from '@/shared/ledger/party-match'
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
import { computeSummary, EMPTY_SUMMARY } from './compute-summary'
import { ExposureHeader, ExposureHeaderSkeleton } from './exposure-header'
import { useAllProposals } from './hooks/use-all-proposals'
import { useBlotterUrlState } from './hooks/use-blotter-url-state'
import { useBlotterValuation } from './hooks/use-blotter-valuation'
import { useTerminateProposals } from './hooks/use-terminate-proposals'
import { maturedToRow, terminatedToRow } from './mappers'
import { RowDetailsDrawer } from './row-details-drawer'
import { SwapTable } from './swap-table'
import { downloadRowsAsCsv } from './to-csv'
import type { BlotterTab, SwapRow } from './types'
import { workflowToRow } from './workflow-to-row'

// Re-export so existing test imports (`from '../page'`) keep working.
export { workflowToRow }

export function Blotter() {
  const { client, activeParty } = useLedgerClient()
  const router = useRouter()
  const isOperator = useIsOperator()
  const isRegulator = useIsRegulator()
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

  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<
    ContractResult<SwapWorkflow>[]
  >({
    queryKey: ['workflows', activeParty],
    queryFn: async () => {
      if (!client) return []
      return await client.query<ContractResult<SwapWorkflow>>('Swap.Workflow:SwapWorkflow')
    },
    enabled: !!client,
    refetchInterval: 3000,
  })

  const { data: maturedContracts = [], isLoading: maturedLoading } = useQuery<
    ContractResult<MaturedSwap>[]
  >({
    queryKey: ['matured', activeParty],
    queryFn: async () => {
      if (!client) return []
      return await client.query<ContractResult<MaturedSwap>>('Swap.Workflow:MaturedSwap')
    },
    enabled: !!client,
    refetchInterval: 3000,
  })

  const { data: terminatedContracts = [], isLoading: terminatedLoading } = useQuery<
    ContractResult<TerminatedSwap>[]
  >({
    queryKey: ['terminated', activeParty],
    queryFn: async () => {
      if (!client) return []
      return await client.query<ContractResult<TerminatedSwap>>('Swap.Terminate:TerminatedSwap')
    },
    enabled: !!client,
    refetchInterval: 3000,
  })

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

  const isLoading = workflowsLoading || proposalsLoading || maturedLoading || terminatedLoading
  // activeParty from AuthState is already the party hint (PartyA/PartyB) used for on-chain matching
  const partyHint = activeParty ?? ''

  const matchesCounterpartyFilter = (row: { counterparty: string }) =>
    counterpartyHint === null || partyMatchesHint(row.counterparty, counterpartyHint)

  const activeRows = workflows
    .map((w) =>
      workflowToRow(
        w,
        partyHint,
        valuations.get(w.contractId),
        byInstrumentId.get(w.payload.instrumentKey.id.unpack),
        terminateProposals,
      ),
    )
    .filter(matchesCounterpartyFilter)

  const filteredProposalRows = proposalRows.filter(matchesCounterpartyFilter)

  const drafts = listDrafts()
  const draftRows: SwapRow[] = drafts.map((d) => ({
    contractId: d.draftId,
    type: d.type,
    counterparty: '—',
    notional: d.notional,
    currency: 'USD',
    tradeDate: '—',
    maturity: '—',
    npv: null,
    dv01: null,
    status: 'Draft' as const,
    direction: 'pay' as const,
  }))

  const maturedRows: SwapRow[] = maturedContracts
    .map((c) => maturedToRow(c, partyHint, byInstrumentId.get(c.payload.instrumentKey.id.unpack)))
    .filter(matchesCounterpartyFilter)
    .sort((a, b) => (b.terminalDate ?? '').localeCompare(a.terminalDate ?? ''))

  const unwoundRows: SwapRow[] = terminatedContracts
    .map((c) =>
      terminatedToRow(c, partyHint, byInstrumentId.get(c.payload.instrumentKey.id.unpack)),
    )
    .filter(matchesCounterpartyFilter)
    .sort((a, b) => (b.terminalDate ?? '').localeCompare(a.terminalDate ?? ''))

  const summary =
    activeRows.length > 0 || filteredProposalRows.length > 0
      ? computeSummary(activeRows, filteredProposalRows, csaSummary)
      : {
          ...EMPTY_SUMMARY,
          csaCount: csaSummary.count,
          csaConfigured: csaSummary.configured,
          csaOwnPosted: csaSummary.ownPosted,
          csaCptyPosted: csaSummary.cptyPosted,
          csaExposure: csaSummary.exposure,
          csaState: csaSummary.state,
          csaRegulatorHints: csaSummary.regulatorHints,
        }

  const exposureHeaderData = {
    bookNpv: summary.bookNpv,
    bookDv01: summary.bookDv01,
    totalNotional: summary.totalNotional,
    activeSwaps: summary.activeSwaps,
    swapCountByType: summary.swapCountByType,
    asOf: curve?.asOf ?? null,
    csa: {
      configured: summary.csaConfigured,
      ownPosted: summary.csaOwnPosted,
      cptyPosted: summary.csaCptyPosted,
      exposure: summary.csaExposure,
      state: summary.csaState,
      regulatorHints: summary.csaRegulatorHints,
    },
  }

  const tabCounts: Record<BlotterTab, number> = {
    active: activeRows.length,
    proposals: filteredProposalRows.length,
    drafts: draftRows.length,
    matured: maturedRows.length,
    unwound: unwoundRows.length,
  }

  const currentRows =
    activeTab === 'active'
      ? activeRows
      : activeTab === 'proposals'
        ? filteredProposalRows
        : activeTab === 'drafts'
          ? draftRows
          : activeTab === 'matured'
            ? maturedRows
            : /* unwound */ unwoundRows

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
      {isLoading ? (
        <ExposureHeaderSkeleton />
      ) : (
        <ExposureHeader data={exposureHeaderData} csaHref={csaBase} />
      )}
      <SwapTable
        rows={currentRows}
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
        isLoading={isLoading}
        onOpenDetails={setDrawerRow}
        onExportCsv={() => downloadRowsAsCsv(currentRows, activeTab)}
        exportDisabled={currentRows.length === 0}
      />
      <RowDetailsDrawer row={drawerRow} onClose={() => setDrawerRow(null)} />
    </div>
  )
}
