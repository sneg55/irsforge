import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { LedgerClient } from '@/shared/ledger/client'
import { resolveMatureInputs, resolveSettlementInputs } from '../../ledger/settlement-inputs'
import {
  exerciseProposalChoice,
  exerciseWorkflowChoice,
  proposeSwap,
} from '../../ledger/swap-actions'
import type { StatusAction } from '../../types'
import { useWorkspaceCommands } from '../use-workspace-commands'
import { initialWorkspaceState } from '../use-workspace-reducer'

vi.mock('../../ledger/swap-actions', () => ({
  proposeSwap: vi.fn(async () => ({ contractId: 'p-new' })),
  exerciseProposalChoice: vi.fn(async () => ({ workflowContractId: 'wf-new' })),
  exerciseWorkflowChoice: vi.fn(async () => undefined),
  createTerminateProposal: vi.fn(async () => ({ contractId: 'tp-1' })),
  exerciseTerminateProposalChoice: vi.fn(async () => undefined),
}))

vi.mock('../../ledger/settlement-inputs', () => ({
  resolveSettlementInputs: vi.fn(async () => ({
    effectCids: ['e-1'],
    settlementFactoryCid: 'sf-1',
    routeProviderCid: 'rp-1',
    partyAHoldingCid: 'h-A',
    partyBHoldingCid: 'h-B',
    partyAAccountKey: { custodian: 'Op::ns', owner: 'A::ns', id: { unpack: 'a' } },
    partyBAccountKey: { custodian: 'Op::ns', owner: 'B::ns', id: { unpack: 'b' } },
    usdInstrumentKey: {
      depository: 'Op::ns',
      issuer: 'Op::ns',
      id: { unpack: 'USD' },
      version: '0',
      holdingStandard: 'TransferableFungible',
    },
  })),
  resolveMatureInputs: vi.fn(async () => ({
    effectCids: ['e-1'],
    settlementFactoryCid: 'sf-1',
    routeProviderCid: 'rp-1',
    partyAHoldingCid: 'h-A',
    partyBHoldingCid: 'h-B',
    partyAAccountKey: { custodian: 'Op::ns', owner: 'A::ns', id: { unpack: 'a' } },
    partyBAccountKey: { custodian: 'Op::ns', owner: 'B::ns', id: { unpack: 'b' } },
    usdInstrumentKey: {
      depository: 'Op::ns',
      issuer: 'Op::ns',
      id: { unpack: 'USD' },
      version: '0',
      holdingStandard: 'TransferableFungible',
    },
  })),
  resolveTerminateInputs: vi.fn(async () => ({
    settlementFactoryCid: 'sf-1',
    routeProviderCid: 'rp-1',
    proposerHoldingCid: 'h-A',
    counterpartyHoldingCid: 'h-B',
    proposerAccountKey: { custodian: 'Op::ns', owner: 'A::ns', id: { unpack: 'a' } },
    counterpartyAccountKey: { custodian: 'Op::ns', owner: 'B::ns', id: { unpack: 'b' } },
    usdInstrumentKey: {
      depository: 'Op::ns',
      issuer: 'Op::ns',
      id: { unpack: 'USD' },
      version: '0',
      holdingStandard: 'TransferableFungible',
    },
  })),
}))

const fakeClient = {} as LedgerClient

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useWorkspaceCommands.propose', () => {
  test('calls proposeSwap and dispatches PROPOSE_SUCCESS with returned cid', async () => {
    const dispatch = vi.fn()
    const state = { ...initialWorkspaceState('draft-1'), counterparty: 'PartyB' }
    const { result } = renderHook(() =>
      useWorkspaceCommands({ client: fakeClient, activeParty: 'PartyA', state, dispatch }),
    )

    await act(async () => {
      await result.current.propose()
    })

    expect(proposeSwap).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({
        swapType: state.swapType,
        proposerHint: 'PartyA',
        counterpartyHint: 'PartyB',
      }),
    )
    expect(dispatch).toHaveBeenCalledWith({ type: 'PROPOSE_SUCCESS', contractId: 'p-new' })
  })

  test('no-op alert + no dispatch when client missing', async () => {
    const dispatch = vi.fn()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const state = initialWorkspaceState('draft-1')
    const { result } = renderHook(() =>
      useWorkspaceCommands({ client: null, activeParty: 'PartyA', state, dispatch }),
    )

    await act(async () => {
      await result.current.propose()
    })

    expect(proposeSwap).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalled()
    alertSpy.mockRestore()
  })
})

describe('useWorkspaceCommands.exerciseAction', () => {
  test('proposal target dispatches EXERCISE_SUCCESS with workflowContractId', async () => {
    const dispatch = vi.fn()
    const state = {
      ...initialWorkspaceState('draft-1'),
      contractId: 'p-1',
      swapStatus: 'Proposed' as const,
    }
    const { result } = renderHook(() =>
      useWorkspaceCommands({ client: fakeClient, activeParty: 'PartyA', state, dispatch }),
    )

    const action: StatusAction = {
      target: 'proposal',
      choice: 'accept',
      label: 'Accept',
      variant: 'primary',
    }
    await act(async () => {
      await result.current.exerciseAction(action)
    })

    expect(exerciseProposalChoice).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({
        swapType: state.swapType,
        proposalContractId: 'p-1',
        choiceKey: 'accept',
      }),
    )
    expect(dispatch).toHaveBeenCalledWith({
      type: 'EXERCISE_SUCCESS',
      choiceKey: 'accept',
      workflowContractId: 'wf-new',
    })
  })

  test('workflow target forwards to exerciseWorkflowChoice with state.workflowContractId', async () => {
    const dispatch = vi.fn()
    const state = { ...initialWorkspaceState('draft-1'), workflowContractId: 'wf-1' }
    const { result } = renderHook(() =>
      useWorkspaceCommands({ client: fakeClient, activeParty: 'PartyA', state, dispatch }),
    )

    const action: StatusAction = {
      target: 'workflow',
      choice: 'Terminate',
      label: 'Terminate',
      variant: 'primary',
    }
    await act(async () => {
      await result.current.exerciseAction(action, { reason: 'test' })
    })

    expect(exerciseWorkflowChoice).toHaveBeenCalledWith(fakeClient, {
      workflowContractId: 'wf-1',
      choice: 'Terminate',
      args: { reason: 'test' },
    })
    // Workflow choices bump the refetch nonce so useActiveContracts re-runs
    // and picks up any new Effects / archived workflow state.
    expect(dispatch).toHaveBeenCalledWith({ type: 'REFETCH_ACTIVE_CONTRACTS' })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  test('throws when client missing', async () => {
    const dispatch = vi.fn()
    const state = initialWorkspaceState('draft-1')
    const { result } = renderHook(() =>
      useWorkspaceCommands({ client: null, activeParty: 'PartyA', state, dispatch }),
    )

    const action: StatusAction = {
      target: 'proposal',
      choice: 'accept',
      label: 'Accept',
      variant: 'primary',
    }
    await expect(
      act(async () => {
        await result.current.exerciseAction(action)
      }),
    ).rejects.toThrow(/ledger client/i)
  })

  test('workflow Settle resolves inputs and forwards composed args', async () => {
    const dispatch = vi.fn()
    const state = {
      ...initialWorkspaceState('d'),
      workflowContractId: 'wf-1',
      workflowPartyA: 'PartyA::ns',
      workflowPartyB: 'PartyB::ns',
    }
    const { result } = renderHook(() =>
      useWorkspaceCommands({ client: fakeClient, activeParty: 'PartyA', state, dispatch }),
    )

    const action: StatusAction = {
      target: 'workflow',
      choice: 'Settle',
      label: 'Settle',
      variant: 'primary',
      operatorOnly: true,
    }
    await act(async () => {
      await result.current.exerciseAction(action)
    })

    expect(resolveSettlementInputs).toHaveBeenCalledWith(fakeClient, {
      workflowContractId: 'wf-1',
      partyA: 'PartyA::ns',
      partyB: 'PartyB::ns',
    })
    expect(exerciseWorkflowChoice).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({
        workflowContractId: 'wf-1',
        choice: 'Settle',
        args: expect.objectContaining({
          effectCids: ['e-1'],
          settlementFactoryCid: 'sf-1',
        }),
      }),
    )
  })

  test('workflow Mature resolves inputs and forwards composed args', async () => {
    const dispatch = vi.fn()
    const state = {
      ...initialWorkspaceState('d'),
      workflowContractId: 'wf-1',
      workflowPartyA: 'PartyA::ns',
      workflowPartyB: 'PartyB::ns',
    }
    const { result } = renderHook(() =>
      useWorkspaceCommands({ client: fakeClient, activeParty: 'PartyA', state, dispatch }),
    )

    const action: StatusAction = {
      target: 'workflow',
      choice: 'Mature',
      label: 'Mature',
      variant: 'primary',
      operatorOnly: true,
    }
    await act(async () => {
      await result.current.exerciseAction(action)
    })

    expect(resolveMatureInputs).toHaveBeenCalledWith(fakeClient, {
      workflowContractId: 'wf-1',
      partyA: 'PartyA::ns',
      partyB: 'PartyB::ns',
    })
    expect(exerciseWorkflowChoice).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({
        choice: 'Mature',
        args: expect.objectContaining({
          effectCids: ['e-1'],
          usdInstrumentKey: expect.any(Object),
        }),
      }),
    )
  })
})
