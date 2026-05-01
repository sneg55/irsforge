'use client'

import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { useWorkspaceCommands } from './use-workspace-commands'
import { useWorkspaceEffects } from './use-workspace-effects'
import { useWorkspaceSelectors } from './use-workspace-selectors'
import { useWorkspaceState } from './use-workspace-state'

/**
 * Workspace orchestrator. Composes four focused hooks and returns the
 * exact same public shape downstream consumers depend on.
 */
export function useWorkspace() {
  const { client, activeParty } = useLedgerClient()
  const { state, dispatch, actions } = useWorkspaceState()
  const { swapConfig, notionalMatch } = useWorkspaceSelectors(state)

  useWorkspaceEffects({
    client,
    activeParty,
    state,
    dispatch,
    swapConfig,
    notionalMatch,
  })

  const { propose, proposeTerminate, exerciseAction } = useWorkspaceCommands({
    client,
    activeParty,
    state,
    dispatch,
  })

  return {
    mode: state.mode,
    swapType: state.swapType,
    legs: state.legs,
    dates: state.dates,
    contractId: state.contractId,
    workflowContractId: state.workflowContractId,
    workflowInstrument: state.workflowInstrument,
    workflowRegulators: state.workflowRegulators,
    swapStatus: state.swapStatus,
    proposalRole: state.proposalRole,
    counterparty: state.counterparty,
    swapConfig,
    draftId: state.draftId,
    outstandingEffectsCount: state.outstandingEffectsCount,
    isPastMaturity: state.isPastMaturity,
    pendingUnwind: state.pendingUnwind,
    unwindRole: state.unwindRole,
    creditSpread: state.creditSpread,
    notionalLinked: state.notionalLinked,
    proposeTerminate,
    setSwapType: actions.setSwapType,
    updateLeg: actions.updateLeg,
    setLegNotional: actions.setLegNotional,
    toggleNotionalLink: actions.toggleNotionalLink,
    updateDateField: actions.updateDateField,
    toggleDirection: actions.toggleDirection,
    toggleWhatIf: actions.toggleWhatIf,
    setCounterparty: actions.setCounterparty,
    addLeg: actions.addLeg,
    removeLeg: actions.removeLeg,
    setCreditSpread: actions.setCreditSpread,
    propose,
    exerciseAction,
  }
}
