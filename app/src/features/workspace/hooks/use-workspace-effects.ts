'use client'

import type { Dispatch } from 'react'
import type { LedgerClient } from '@/shared/ledger/client'
import type { SwapConfig } from '../types'
import { useActiveContracts } from './use-active-contracts'
import { useDraftAutosave } from './use-draft-autosave'
import { useProposalRole } from './use-proposal-role'
import type { Action, WorkspaceReducerState } from './use-workspace-reducer'
import { useWorkspaceUrlInit } from './use-workspace-url-init'

/**
 * Aggregates every side-effect hook the workspace needs:
 *  - URL hydration (?draft= / ?swap= query param → reducer)
 *  - Proposal role resolution (queries proposal templates to infer proposer/counterparty role)
 *  - Active-contract resolution (queries SwapWorkflow when Active)
 *  - Draft autosave (debounced localStorage write)
 *
 * Keeping these together means the composer doesn't need to know that any
 * of them exist — one call, one dep object.
 */
export function useWorkspaceEffects(args: {
  client: LedgerClient | null
  activeParty: string | null
  state: WorkspaceReducerState
  dispatch: Dispatch<Action>
  swapConfig: SwapConfig
  notionalMatch: number | null
}): void {
  const { client, activeParty, state, dispatch, swapConfig, notionalMatch } = args

  useWorkspaceUrlInit(dispatch)

  useProposalRole(
    {
      contractId: state.contractId,
      client,
      activeParty,
      swapStatus: state.swapStatus,
      alreadyResolved: !!state.proposalRole && !!state.counterparty,
    },
    dispatch,
  )

  useActiveContracts(
    {
      client,
      activeParty,
      swapStatus: state.swapStatus,
      proposalContractId: state.contractId,
      notionalMatch,
      refetchNonce: state.activeContractsRefetchNonce,
    },
    dispatch,
  )

  useDraftAutosave({ mode: state.mode, draftId: state.draftId, swapConfig })
}
