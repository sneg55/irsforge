import type { DiscountCurve } from '@irsforge/shared-pricing'
import type { CsaSummary } from '@/features/csa/hooks/use-csa-summary'
import type { DraftSummary } from '@/features/workspace/types'
import { partyMatchesHint } from '@/shared/ledger/party-match'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import type {
  ContractResult,
  MaturedSwap,
  SwapWorkflow,
  TerminatedSwap,
} from '@/shared/ledger/types'
import { computeSummary, EMPTY_SUMMARY } from './compute-summary'
import type { BlotterValuation } from './hooks/use-blotter-valuation'
import type { TerminateProposalEntry } from './hooks/use-terminate-proposals'
import { maturedToRow, terminatedToRow } from './mappers'
import type { BlotterTab, SwapRow } from './types'
import { workflowToRow } from './workflow-to-row'

// All inputs the page derives its view-model from. Kept as one big record
// (rather than positional args) so callers don't have to remember an
// 11-parameter argument order — the page already passes everything by
// name and the hook factory pattern is a poor fit for a pure function.
export interface DeriveViewModelInputs {
  readonly workflows: readonly ContractResult<SwapWorkflow>[]
  readonly maturedContracts: readonly ContractResult<MaturedSwap>[]
  readonly terminatedContracts: readonly ContractResult<TerminatedSwap>[]
  readonly proposalRows: readonly SwapRow[]
  readonly drafts: readonly DraftSummary[]
  readonly partyHint: string
  readonly counterpartyHint: string | null
  readonly csaSummary: CsaSummary
  readonly valuations: Map<string, BlotterValuation>
  readonly byInstrumentId: Map<string, SwapInstrumentPayload>
  readonly terminateProposals: Map<string, TerminateProposalEntry>
  readonly curve: DiscountCurve | null
  readonly activeTab: BlotterTab
}

export interface BlotterViewModel {
  readonly activeRows: readonly SwapRow[]
  readonly filteredProposalRows: readonly SwapRow[]
  readonly draftRows: readonly SwapRow[]
  readonly maturedRows: readonly SwapRow[]
  readonly unwoundRows: readonly SwapRow[]
  readonly summary: ReturnType<typeof computeSummary>
  readonly exposureHeaderData: {
    readonly bookNpv: number
    readonly bookDv01: number
    readonly totalNotional: number
    readonly activeSwaps: number
    readonly swapCountByType: Record<string, number>
    readonly asOf: string | null
    readonly csa: {
      readonly configured: boolean
      readonly ownPosted: number
      readonly cptyPosted: number
      readonly exposure: number | null
      readonly state: CsaSummary['state']
      readonly regulatorHints: CsaSummary['regulatorHints']
    }
  }
  readonly tabCounts: Record<BlotterTab, number>
  readonly currentRows: readonly SwapRow[]
}

export function deriveBlotterViewModel(input: DeriveViewModelInputs): BlotterViewModel {
  const {
    workflows,
    maturedContracts,
    terminatedContracts,
    proposalRows,
    drafts,
    partyHint,
    counterpartyHint,
    csaSummary,
    valuations,
    byInstrumentId,
    terminateProposals,
    curve,
    activeTab,
  } = input

  const matchesCpty = (row: { counterparty: string }) =>
    counterpartyHint === null || partyMatchesHint(row.counterparty, counterpartyHint)

  const activeRows: SwapRow[] = workflows
    .map((w) =>
      workflowToRow(
        w,
        partyHint,
        valuations.get(w.contractId),
        byInstrumentId.get(w.payload.instrumentKey.id.unpack),
        terminateProposals,
      ),
    )
    .filter(matchesCpty)

  const filteredProposalRows = proposalRows.filter(matchesCpty)

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
    .filter(matchesCpty)
    .sort((a, b) => (b.terminalDate ?? '').localeCompare(a.terminalDate ?? ''))

  const unwoundRows: SwapRow[] = terminatedContracts
    .map((c) =>
      terminatedToRow(c, partyHint, byInstrumentId.get(c.payload.instrumentKey.id.unpack)),
    )
    .filter(matchesCpty)
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

  return {
    activeRows,
    filteredProposalRows,
    draftRows,
    maturedRows,
    unwoundRows,
    summary,
    exposureHeaderData,
    tabCounts,
    currentRows,
  }
}
