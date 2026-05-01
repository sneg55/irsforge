/**
 * Tests for useActiveContracts — workflow resolution behaviour:
 * SET_WORKFLOW_CONTRACT, SET_WORKFLOW_PARTIES, SET_IS_PAST_MATURITY,
 * spurious-transition guard, URL-hydrate path, refetchNonce.
 */

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

describe('useActiveContracts — workflow resolution', () => {
  test('dispatches SET_WORKFLOW_CONTRACT when matching workflow found', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        { contractId: 'wf-1', payload: wfPayload({ notional: '1000000' }) },
      ],
    })
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Active',
            proposalContractId: 'p-1',
            notionalMatch: 1_000_000,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_WORKFLOW_CONTRACT', contractId: 'wf-1' }),
    )
  })

  test('no dispatch when proposalContractId is null', async () => {
    const dispatch = vi.fn()
    const client = fakeClient()
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Proposed',
            proposalContractId: null,
            notionalMatch: null,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await new Promise((r) => setTimeout(r, 10))
    expect(client.query).not.toHaveBeenCalled()
    // Both SET_WORKFLOW_INSTRUMENT and SET_IS_PAST_MATURITY are dispatched by
    // the instrument-effect useEffect (which fires unconditionally on mount
    // with resolvedWorkflow=null). Neither triggers a ledger query — that
    // guard is the important property being tested here.
    const instrumentEffectTypes = new Set(['SET_WORKFLOW_INSTRUMENT', 'SET_IS_PAST_MATURITY'])
    const unexpectedDispatches = dispatch.mock.calls.filter(
      (c) => !instrumentEffectTypes.has((c[0] as { type: string }).type),
    )
    expect(unexpectedDispatches).toHaveLength(0)
  })

  test('does NOT spuriously transition Proposed view when only notional matches an unrelated workflow', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        { contractId: 'unrelated-workflow', payload: wfPayload({ notional: '25000000' }) },
      ],
    })
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Proposed',
            proposalContractId: 'viewing-a-proposal-cid',
            notionalMatch: 25_000_000,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await new Promise((r) => setTimeout(r, 30))
    const workflowDispatches = dispatch.mock.calls.filter(
      (c) => (c[0] as { type: string }).type === 'SET_WORKFLOW_CONTRACT',
    )
    expect(workflowDispatches).toHaveLength(0)
  })

  test('resolves workflow on URL hydrate when swapStatus is still Proposed', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        { contractId: 'wf-hydrated', payload: wfPayload({ notional: '2500000' }) },
      ],
    })
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Proposed',
            proposalContractId: 'wf-hydrated',
            notionalMatch: 2_500_000,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_WORKFLOW_CONTRACT',
        contractId: 'wf-hydrated',
      }),
    )
  })

  test('disambiguates multiple party workflows by notionalMatch', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        { contractId: 'wf-a', payload: wfPayload({ partyB: 'Bob::ns', notional: '500000' }) },
        { contractId: 'wf-b', payload: wfPayload({ partyB: 'Carol::ns', notional: '1000000' }) },
        { contractId: 'wf-c', payload: wfPayload({ partyB: 'Dave::ns', notional: '2000000' }) },
      ],
    })
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Active',
            proposalContractId: 'p-2',
            notionalMatch: 1_000_000,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_WORKFLOW_CONTRACT', contractId: 'wf-b' }),
    )
    const workflowDispatches = dispatch.mock.calls.filter(
      (c) => (c[0] as { type: string }).type === 'SET_WORKFLOW_CONTRACT',
    )
    expect(workflowDispatches).toHaveLength(1)
  })

  test('dispatches SET_WORKFLOW_PARTIES from the matched workflow payload', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        {
          contractId: 'wf-1',
          payload: wfPayload({ partyA: 'Alice::ns', partyB: 'Bob::ns', notional: '1000000' }),
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
        type: 'SET_WORKFLOW_PARTIES',
        partyA: 'Alice::ns',
        partyB: 'Bob::ns',
      }),
    )
  })

  test('dispatches SET_IS_PAST_MATURITY=false when instrument not yet in map', async () => {
    // The slim SwapWorkflow no longer carries maturityDate. Past-maturity is
    // derived from the on-chain instrument in the instrument-effect useEffect.
    // When the instrument map is empty (instrument not yet loaded) the gate
    // stays false — the hook re-evaluates once useSwapInstruments resolves.
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        { contractId: 'wf-1', payload: wfPayload({ notional: '1000000' }) },
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
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_IS_PAST_MATURITY', value: false }),
    )
  })

  test('bumping refetchNonce re-queries workflow and effect state', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        { contractId: 'wf-1', payload: wfPayload({ notional: '1000000' }) },
      ],
    })
    const { rerender } = renderHook(
      ({ nonce }: { nonce: number }) =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Active',
            proposalContractId: 'p',
            notionalMatch: 1_000_000,
            refetchNonce: nonce,
          },
          dispatch,
        ),
      { initialProps: { nonce: 0 }, wrapper: makeWrapper() },
    )
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_WORKFLOW_CONTRACT', contractId: 'wf-1' }),
    )
    const callsAfterInitial = client.query.mock.calls.length
    expect(callsAfterInitial).toBeGreaterThan(0)
    rerender({ nonce: 1 })
    await waitFor(() => expect(client.query.mock.calls.length).toBeGreaterThan(callsAfterInitial))
  })
})
