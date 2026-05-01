import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import { SWAP_TYPE_CONFIGS } from '../constants'
import type { LegConfig, SwapConfig, SwapStatus, SwapType, WorkspaceMode } from '../types'
import type { DateAnchor, WorkspaceDates } from '../utils/date-recalc'
import { buildDefaultWorkspaceDates, recalculateDates, validateDates } from '../utils/date-recalc'
import type { Tenor } from '../utils/tenor-parser'
import { computeTenor } from '../utils/tenor-parser'
import type { Action, PendingUnwind } from './use-workspace-reducer.actions'

import {
  backfillDirection,
  buildDefaultFloat,
  notionalLinkedDefault,
  syncLegSchedules,
} from './workspace-reducer-helpers'

export type { Action, PendingUnwind }

export type WorkspaceReducerState = {
  mode: WorkspaceMode
  swapType: SwapType
  legs: LegConfig[]
  dates: WorkspaceDates
  draftId: string
  counterparty: string
  contractId: string | null
  swapStatus: SwapStatus | null
  proposalRole: 'proposer' | 'counterparty' | null
  workflowContractId: string | null
  whatIfOriginal: { legs: LegConfig[]; dates: WorkspaceDates } | null
  workflowPartyA: string | null
  workflowPartyB: string | null
  /**
   * Regulator parties observing the resolved SwapWorkflow. Drives the
   * "Regulator visible" pill in OnChainPanel. Empty until a workflow
   * matches; cleared on logout / draft-reset paths.
   */
  workflowRegulators: string[]
  /**
   * On-chain instrument for the currently-resolved SwapWorkflow (null until
   * both the workflow match and the instrument fetch complete). Carried so
   * that TriggerLifecycle can resolve per-family rate ids — CDS carries
   * `defaultProbabilityReferenceId` + `recoveryRateReferenceId` verbatim,
   * ASSET carries `underlyings[].referenceAssetId`, etc.
   */
  workflowInstrument: SwapInstrumentPayload | null
  outstandingEffectsCount: number
  isPastMaturity: boolean
  pendingUnwind: PendingUnwind | null
  unwindRole: 'proposer' | 'counterparty' | null
  /**
   * Monotonically-incrementing counter that `useActiveContracts` includes in
   * its useEffect deps. Ledger-mutating actions (TriggerLifecycle, Settle,
   * Mature, PostMargin, TerminateProposal.*) bump this so the next render
   * re-queries workflow/margin/Effect/TerminateProposal state without
   * requiring a page reload or a status transition. React's deps array is
   * reference-equal: a plain counter bump is the cheapest invalidation
   * signal we can give it.
   */
  activeContractsRefetchNonce: number
  /**
   * CDS-only: annualised hazard rate (dimensionless; 0.02 = 200bp).
   * Matches DEFAULT_CREDIT_SPREAD from shared-pricing.
   */
  creditSpread: number
  /**
   * When true, editing any leg's notional syncs all legs. Defaults to true for
   * single-currency swaps (IRS/OIS/BASIS) and false for multi-currency or
   * structured products (XCCY/CDS/FX/ASSET/CCY/FpML).
   */
  notionalLinked: boolean
}

export function initialWorkspaceState(draftId: string): WorkspaceReducerState {
  const dates = buildDefaultWorkspaceDates()
  const legs = SWAP_TYPE_CONFIGS.IRS.defaultLegs.map((l) => ({ ...l }))
  return {
    mode: 'draft',
    swapType: 'IRS',
    legs: syncLegSchedules(legs, dates),
    dates,
    draftId,
    counterparty: '',
    contractId: null,
    swapStatus: null,
    proposalRole: null,
    workflowContractId: null,
    whatIfOriginal: null,
    workflowPartyA: null,
    workflowPartyB: null,
    workflowRegulators: [],
    workflowInstrument: null,
    outstandingEffectsCount: 0,
    isPastMaturity: false,
    pendingUnwind: null,
    unwindRole: null,
    activeContractsRefetchNonce: 0,
    creditSpread: 0.02,
    notionalLinked: notionalLinkedDefault('IRS'),
  }
}

export function workspaceReducer(
  state: WorkspaceReducerState,
  action: Action,
): WorkspaceReducerState {
  switch (action.type) {
    case 'SET_SWAP_TYPE': {
      if (state.mode !== 'draft') return state
      const freshLegs = SWAP_TYPE_CONFIGS[action.swapType].defaultLegs.map((l) => ({ ...l }))
      return {
        ...state,
        swapType: action.swapType,
        legs: syncLegSchedules(freshLegs, state.dates),
        notionalLinked: notionalLinkedDefault(action.swapType),
      }
    }
    case 'UPDATE_LEG': {
      const next = state.legs.map((l) => ({ ...l }))
      const leg = next[action.index]
      if (!leg) return state
      if (action.field === 'frequency' && 'schedule' in leg && leg.schedule) {
        next[action.index] = {
          ...leg,
          schedule: { ...leg.schedule, frequency: action.value as string },
        } as typeof leg
      } else {
        // FieldGrid always emits strings from inputs, but the pricing engine
        // uses `+` on spreads/rates/notionals, which string-concatenates and
        // yields NaN. Coerce any string that parses to a finite number so
        // numeric fields stay numeric. Non-numeric string fields (currency
        // codes, indexIds, dayCount enums) won't match the numeric regex.
        const raw = action.value
        let nextValue: unknown = raw
        if (typeof raw === 'string' && /^-?\d*\.?\d+$/.test(raw.trim())) {
          const n = Number(raw)
          if (Number.isFinite(n)) nextValue = n
        }
        ;(leg as Record<string, unknown>)[action.field] = nextValue
      }
      return { ...state, legs: next }
    }
    case 'ADD_LEG': {
      const newLeg = buildDefaultFloat()
      const syncedLeg = syncLegSchedules([newLeg], state.dates)[0]
      return { ...state, legs: [...state.legs, syncedLeg] }
    }
    case 'REMOVE_LEG':
      return { ...state, legs: state.legs.filter((_, i) => i !== action.index) }
    case 'TOGGLE_DIRECTION': {
      const flipped = state.legs.map((leg) => ({
        ...leg,
        direction: leg.direction === 'pay' ? ('receive' as const) : ('pay' as const),
      }))
      return { ...state, legs: flipped }
    }
    case 'SET_DATES': {
      const nextDates = recalculateDates(state.dates, action.anchor, action.value)
      if (validateDates(nextDates)) return state
      return { ...state, dates: nextDates, legs: syncLegSchedules(state.legs, nextDates) }
    }
    case 'SET_COUNTERPARTY':
      return { ...state, counterparty: action.party }
    case 'HYDRATE_FROM_DRAFT': {
      const { draftId, config } = action
      const filled = backfillDirection(config)
      const tenor = computeTenor(filled.effectiveDate, filled.maturityDate)
      const dates: WorkspaceDates = {
        tradeDate: filled.tradeDate,
        effectiveDate: filled.effectiveDate,
        maturityDate: filled.maturityDate,
        tenor,
        anchor: 'tenor',
        effManuallySet: filled.effectiveDate.getTime() !== filled.tradeDate.getTime(),
      }
      return {
        ...state,
        draftId,
        swapType: filled.type,
        legs: filled.legs.map((l) => ({ ...l })),
        dates,
        creditSpread: filled.creditSpread ?? 0.02,
        notionalLinked:
          (filled as SwapConfig & { notionalLinked?: boolean }).notionalLinked ??
          notionalLinkedDefault(filled.type),
      }
    }
    case 'HYDRATE_FROM_SWAP':
      return { ...state, contractId: action.contractId, mode: 'active', swapStatus: 'Proposed' }
    case 'RESOLVE_PROPOSAL':
      return {
        ...state,
        swapType: action.swapType,
        proposalRole: action.role,
        counterparty: action.counterparty,
      }
    case 'HYDRATE_PROPOSAL_PAYLOAD':
      // Only overwrite leg/date shape once, before the user enters What-If.
      // In What-If mode we must not clobber scenario edits with a late-
      // arriving query result.
      if (state.mode === 'whatif') return state
      return {
        ...state,
        swapType: action.swapType,
        legs: action.legs.map((l) => ({ ...l })),
        dates: { ...action.dates },
      }
    case 'ENTER_WHATIF':
      if (state.mode !== 'active') return state
      return {
        ...state,
        mode: 'whatif',
        whatIfOriginal: { legs: state.legs.map((l) => ({ ...l })), dates: { ...state.dates } },
      }
    case 'EXIT_WHATIF':
      if (state.mode !== 'whatif' || !state.whatIfOriginal) return state
      return {
        ...state,
        mode: 'active',
        legs: state.whatIfOriginal.legs.map((l) => ({ ...l })),
        dates: { ...state.whatIfOriginal.dates },
        whatIfOriginal: null,
      }
    case 'PROPOSE_SUCCESS':
      return {
        ...state,
        contractId: action.contractId,
        swapStatus: 'Proposed',
        proposalRole: 'proposer',
        mode: 'active',
      }
    case 'EXERCISE_SUCCESS':
      if (action.choiceKey === 'accept') {
        return {
          ...state,
          swapStatus: 'Active',
          proposalRole: null,
          workflowContractId: action.workflowContractId ?? state.workflowContractId,
        }
      }
      return { ...state, swapStatus: 'Terminated', proposalRole: null }
    case 'SET_WORKFLOW_CONTRACT':
      return {
        ...state,
        workflowContractId: action.contractId,
        swapStatus: 'Active',
        proposalRole: null,
      }
    case 'SET_DRAFT_ID':
      return { ...state, draftId: action.draftId }
    case 'SET_WORKFLOW_PARTIES':
      return { ...state, workflowPartyA: action.partyA, workflowPartyB: action.partyB }
    case 'SET_WORKFLOW_REGULATORS':
      return { ...state, workflowRegulators: action.regulators }
    case 'SET_WORKFLOW_INSTRUMENT':
      return { ...state, workflowInstrument: action.instrument }
    case 'SET_OUTSTANDING_EFFECTS':
      return { ...state, outstandingEffectsCount: action.count }
    case 'SET_IS_PAST_MATURITY':
      return { ...state, isPastMaturity: action.value }
    case 'SET_PENDING_UNWIND':
      if (action.value === null) {
        return { ...state, pendingUnwind: null, unwindRole: null }
      }
      return { ...state, pendingUnwind: action.value.proposal, unwindRole: action.value.role }
    case 'REFETCH_ACTIVE_CONTRACTS':
      return { ...state, activeContractsRefetchNonce: state.activeContractsRefetchNonce + 1 }
    case 'SET_CREDIT_SPREAD':
      return { ...state, creditSpread: action.value }
    case 'SET_LEG_NOTIONAL': {
      const { index, value } = action
      const next = state.legs.map((leg, i) => {
        if (i === index && 'notional' in leg) return { ...leg, notional: value }
        if (state.notionalLinked && 'notional' in leg) return { ...leg, notional: value }
        return leg
      })
      return { ...state, legs: next }
    }
    case 'TOGGLE_NOTIONAL_LINK':
      return { ...state, notionalLinked: !state.notionalLinked }
    default:
      return state
  }
}
