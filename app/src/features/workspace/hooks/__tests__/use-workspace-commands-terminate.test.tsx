import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { LedgerClient } from '@/shared/ledger/client'
import { resolveTerminateInputs } from '../../ledger/settlement-inputs'
import { createTerminateProposal, exerciseTerminateProposalChoice } from '../../ledger/swap-actions'
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
  resolveSettlementInputs: vi.fn(async () => ({})),
  resolveMatureInputs: vi.fn(async () => ({})),
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

const fakeClient = {
  resolvePartyId: vi.fn(async (hint: string) => `${hint}::ns`),
} as unknown as LedgerClient

beforeEach(() => {
  vi.clearAllMocks()
  ;(fakeClient.resolvePartyId as ReturnType<typeof vi.fn>).mockImplementation(
    async (hint: string) => `${hint}::ns`,
  )
})

describe('useWorkspaceCommands.proposeTerminate + TpAccept/Reject/Withdraw', () => {
  test('proposeTerminate creates TerminateProposal via swap-actions', async () => {
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
    await act(async () => {
      await result.current.proposeTerminate({ pvAmount: 1234.56, reason: 'test' })
    })
    expect(createTerminateProposal).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({
        proposer: 'PartyA::ns',
        counterparty: 'PartyB::ns',
        workflowContractId: 'wf-1',
        proposedPvAmount: 1234.56,
        reason: 'test',
      }),
    )
  })

  test('workflow TpAccept resolves inputs and exercises on proposal cid', async () => {
    const dispatch = vi.fn()
    const state = {
      ...initialWorkspaceState('d'),
      workflowContractId: 'wf-1',
      workflowPartyA: 'PartyA::ns',
      workflowPartyB: 'PartyB::ns',
      pendingUnwind: {
        proposalCid: 'tp-1',
        proposer: 'PartyA::ns',
        counterparty: 'PartyB::ns',
        pvAmount: 1000,
        reason: 'r',
        proposedAt: '2026-04-13T00:00:00Z',
      },
      unwindRole: 'counterparty' as const,
    }
    const { result } = renderHook(() =>
      useWorkspaceCommands({ client: fakeClient, activeParty: 'PartyB', state, dispatch }),
    )
    const action: StatusAction = {
      target: 'terminateProposal',
      choice: 'TpAccept',
      label: 'Accept Unwind',
      variant: 'primary',
    }
    await act(async () => {
      await result.current.exerciseAction(action)
    })
    expect(resolveTerminateInputs).toHaveBeenCalledWith(fakeClient, {
      proposer: 'PartyA::ns',
      counterparty: 'PartyB::ns',
    })
    expect(exerciseTerminateProposalChoice).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({
        proposalCid: 'tp-1',
        choice: 'TpAccept',
      }),
    )
  })

  test('TpReject exercises without resolver', async () => {
    const dispatch = vi.fn()
    const state = {
      ...initialWorkspaceState('d'),
      pendingUnwind: {
        proposalCid: 'tp-1',
        proposer: 'PartyA::ns',
        counterparty: 'PartyB::ns',
        pvAmount: 1000,
        reason: 'r',
        proposedAt: 't',
      },
      unwindRole: 'counterparty' as const,
    }
    const { result } = renderHook(() =>
      useWorkspaceCommands({ client: fakeClient, activeParty: 'PartyB', state, dispatch }),
    )
    vi.mocked(resolveTerminateInputs).mockClear()
    const action: StatusAction = {
      target: 'terminateProposal',
      choice: 'TpReject',
      label: 'Reject',
      variant: 'ghost',
    }
    await act(async () => {
      await result.current.exerciseAction(action)
    })
    expect(resolveTerminateInputs).not.toHaveBeenCalled()
    expect(exerciseTerminateProposalChoice).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({
        proposalCid: 'tp-1',
        choice: 'TpReject',
        args: {},
      }),
    )
  })

  test('TpWithdraw exercises without resolver', async () => {
    const dispatch = vi.fn()
    const state = {
      ...initialWorkspaceState('d'),
      pendingUnwind: {
        proposalCid: 'tp-1',
        proposer: 'PartyA::ns',
        counterparty: 'PartyB::ns',
        pvAmount: 1000,
        reason: 'r',
        proposedAt: 't',
      },
      unwindRole: 'proposer' as const,
    }
    const { result } = renderHook(() =>
      useWorkspaceCommands({ client: fakeClient, activeParty: 'PartyA', state, dispatch }),
    )
    const action: StatusAction = {
      target: 'terminateProposal',
      choice: 'TpWithdraw',
      label: 'Withdraw',
      variant: 'ghost',
    }
    await act(async () => {
      await result.current.exerciseAction(action)
    })
    expect(exerciseTerminateProposalChoice).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({
        proposalCid: 'tp-1',
        choice: 'TpWithdraw',
        args: {},
      }),
    )
  })
})
