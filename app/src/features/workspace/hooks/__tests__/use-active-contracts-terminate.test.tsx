import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { LedgerClient } from '@/shared/ledger/client'
import { useActiveContracts } from '../use-active-contracts'
import { fakeClient, makeWrapper, wfPayload } from './active-contracts-fixtures'

vi.mock('@/shared/ledger/generated/package-ids', () => ({
  IRSFORGE_PACKAGE_ID: 'test-irsforge-pkg',
  DAML_FINANCE_DATA_PACKAGE_ID: 'test-daml-finance-data-pkg',
  DAML_FINANCE_LIFECYCLE_PACKAGE_ID: 'test-daml-finance-lifecycle-pkg',
  DAML_FINANCE_HOLDING_PACKAGE_ID: 'test-daml-finance-holding-pkg',
  DAML_FINANCE_CLAIMS_PACKAGE_ID: 'test-daml-finance-claims-pkg',
  DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID: 'test-daml-finance-instrument-swap-pkg',
}))

describe('useActiveContracts — TerminateProposal', () => {
  test('dispatches SET_PENDING_UNWIND with role=proposer when active party is proposer', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        {
          contractId: 'wf-1',
          payload: wfPayload({ partyA: 'Alice::ns', partyB: 'Bob::ns', notional: '1000000' }),
        },
      ],
      'Swap.Terminate:TerminateProposal': [
        {
          contractId: 'tp-1',
          payload: {
            proposer: 'Alice::ns',
            counterparty: 'Bob::ns',
            workflowCid: 'wf-1',
            proposedPvAmount: '5000.0',
            reason: 'Early exit',
            proposedAt: '2026-04-12T10:00:00Z',
          },
        },
      ],
    })
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Active',
            proposalContractId: 'p',
            notionalMatch: 1_000_000,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_PENDING_UNWIND',
        value: {
          proposal: {
            proposalCid: 'tp-1',
            proposer: 'Alice::ns',
            counterparty: 'Bob::ns',
            pvAmount: 5000,
            reason: 'Early exit',
            proposedAt: '2026-04-12T10:00:00Z',
          },
          role: 'proposer',
        },
      }),
    )
  })

  test('dispatches SET_PENDING_UNWIND with role=counterparty when active party is counterparty', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        {
          contractId: 'wf-1',
          payload: wfPayload({ partyA: 'Alice::ns', partyB: 'Bob::ns', notional: '1000000' }),
        },
      ],
      'Swap.Terminate:TerminateProposal': [
        {
          contractId: 'tp-2',
          payload: {
            proposer: 'Alice::ns',
            counterparty: 'Bob::ns',
            workflowCid: 'wf-1',
            proposedPvAmount: '-3000.0',
            reason: 'Restructuring',
            proposedAt: '2026-04-12T11:00:00Z',
          },
        },
      ],
    })
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Bob',
            swapStatus: 'Active',
            proposalContractId: 'p',
            notionalMatch: 1_000_000,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_PENDING_UNWIND',
        value: {
          proposal: {
            proposalCid: 'tp-2',
            proposer: 'Alice::ns',
            counterparty: 'Bob::ns',
            pvAmount: -3000,
            reason: 'Restructuring',
            proposedAt: '2026-04-12T11:00:00Z',
          },
          role: 'counterparty',
        },
      }),
    )
  })

  test('dispatches SET_PENDING_UNWIND with null when no TerminateProposal exists', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        {
          contractId: 'wf-1',
          payload: wfPayload({ partyA: 'Alice::ns', partyB: 'Bob::ns', notional: '1000000' }),
        },
      ],
      'Swap.Terminate:TerminateProposal': [],
    })
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Active',
            proposalContractId: 'p',
            notionalMatch: 1_000_000,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_PENDING_UNWIND', value: null }),
    )
  })
})
