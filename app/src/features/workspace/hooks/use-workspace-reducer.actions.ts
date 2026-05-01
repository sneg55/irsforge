import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import type { LegConfig, SwapConfig, SwapType } from '../types'
import type { DateAnchor, WorkspaceDates } from '../utils/date-recalc'
import type { Tenor } from '../utils/tenor-parser'

export interface PendingUnwind {
  proposalCid: string
  proposer: string
  counterparty: string
  pvAmount: number
  reason: string
  proposedAt: string
}

export type Action =
  | { type: 'SET_SWAP_TYPE'; swapType: SwapType }
  | { type: 'UPDATE_LEG'; index: number; field: string; value: unknown }
  | { type: 'ADD_LEG' }
  | { type: 'REMOVE_LEG'; index: number }
  | { type: 'TOGGLE_DIRECTION' }
  | { type: 'SET_DATES'; anchor: DateAnchor; value: Date | Tenor }
  | { type: 'SET_COUNTERPARTY'; party: string }
  | { type: 'HYDRATE_FROM_DRAFT'; draftId: string; config: SwapConfig }
  | { type: 'HYDRATE_FROM_SWAP'; contractId: string }
  | {
      type: 'RESOLVE_PROPOSAL'
      swapType: SwapType
      role: 'proposer' | 'counterparty'
      counterparty: string
    }
  | {
      type: 'HYDRATE_PROPOSAL_PAYLOAD'
      swapType: SwapType
      legs: LegConfig[]
      dates: WorkspaceDates
    }
  | { type: 'ENTER_WHATIF' }
  | { type: 'EXIT_WHATIF' }
  | { type: 'PROPOSE_SUCCESS'; contractId: string }
  | {
      type: 'EXERCISE_SUCCESS'
      choiceKey: 'accept' | 'reject' | 'withdraw'
      workflowContractId?: string
    }
  | { type: 'SET_DRAFT_ID'; draftId: string }
  | { type: 'SET_WORKFLOW_CONTRACT'; contractId: string }
  | { type: 'SET_WORKFLOW_PARTIES'; partyA: string; partyB: string }
  | { type: 'SET_WORKFLOW_REGULATORS'; regulators: string[] }
  | { type: 'SET_WORKFLOW_INSTRUMENT'; instrument: SwapInstrumentPayload | null }
  | { type: 'SET_OUTSTANDING_EFFECTS'; count: number }
  | { type: 'SET_IS_PAST_MATURITY'; value: boolean }
  | {
      type: 'SET_PENDING_UNWIND'
      value: { proposal: PendingUnwind; role: 'proposer' | 'counterparty' } | null
    }
  | { type: 'REFETCH_ACTIVE_CONTRACTS' }
  | { type: 'SET_CREDIT_SPREAD'; value: number }
  | { type: 'SET_LEG_NOTIONAL'; index: number; value: number }
  | { type: 'TOGGLE_NOTIONAL_LINK' }
