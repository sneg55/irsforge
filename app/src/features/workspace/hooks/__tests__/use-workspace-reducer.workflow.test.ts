import { describe, expect, test } from 'vitest'
import { initialWorkspaceState, workspaceReducer } from '../use-workspace-reducer'

function init() {
  return initialWorkspaceState('draft-wf')
}

describe('SET_WORKFLOW_CONTRACT — workflow phase transition', () => {
  test('transitions swapStatus to Active and clears proposalRole', () => {
    const hydrated = workspaceReducer(init(), { type: 'HYDRATE_FROM_SWAP', contractId: 'any-cid' })
    expect(hydrated.swapStatus).toBe('Proposed')

    const asProposal = workspaceReducer(hydrated, {
      type: 'RESOLVE_PROPOSAL',
      swapType: 'IRS',
      role: 'counterparty',
      counterparty: 'PartyB',
    })
    expect(asProposal.proposalRole).toBe('counterparty')

    const asWorkflow = workspaceReducer(asProposal, {
      type: 'SET_WORKFLOW_CONTRACT',
      contractId: 'wf-456',
    })

    expect(asWorkflow.workflowContractId).toBe('wf-456')
    expect(asWorkflow.swapStatus).toBe('Active')
    expect(asWorkflow.proposalRole).toBeNull()
  })

  test('transition preserves unrelated state (dates, legs, draftId)', () => {
    const hydrated = workspaceReducer(init(), { type: 'HYDRATE_FROM_SWAP', contractId: 'cid-1' })
    const next = workspaceReducer(hydrated, { type: 'SET_WORKFLOW_CONTRACT', contractId: 'wf-1' })
    expect(next.draftId).toBe(hydrated.draftId)
    expect(next.dates).toEqual(hydrated.dates)
    expect(next.legs).toEqual(hydrated.legs)
  })
})
