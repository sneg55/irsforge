/**
 * Regression: when the SwapWorkflow contract id rotates (Daml `create this
 * with <update>` runs on every choice), the hydrate gate must NOT re-fire
 * HYDRATE_PROPOSAL_PAYLOAD for the same logical swap. Otherwise a Settle /
 * PostMargin / Mature triggered after the trader edits the panel would
 * silently clobber those edits on the next refetch.
 *
 * The gate keys on a stable identity (instrumentKey.id.unpack + partyA +
 * partyB), not on the rotating workflow cid.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { LedgerClient } from '@/shared/ledger/client'
import { IRS_INSTRUMENT_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import { useActiveContracts } from '../use-active-contracts'
import { makeWrapper, wfPayload } from './active-contracts-fixtures'
import { irsInstr } from './hydrate-workflow-fixtures'

vi.mock('@/shared/ledger/generated/package-ids', () => ({
  IRSFORGE_PACKAGE_ID: 'test-irsforge-pkg',
  DAML_FINANCE_DATA_PACKAGE_ID: 'test-daml-finance-data-pkg',
  DAML_FINANCE_LIFECYCLE_PACKAGE_ID: 'test-daml-finance-lifecycle-pkg',
  DAML_FINANCE_HOLDING_PACKAGE_ID: 'test-daml-finance-holding-pkg',
  DAML_FINANCE_CLAIMS_PACKAGE_ID: 'test-daml-finance-claims-pkg',
  DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID: 'test-daml-finance-instrument-swap-pkg',
}))

describe('useActiveContracts — hydrate gate survives cid rotation', () => {
  test('rotating workflow cid for the same logical swap does NOT re-fire HYDRATE_PROPOSAL_PAYLOAD', async () => {
    const dispatch = vi.fn()

    // Workflow's instrumentKey.id.unpack must match the IRS instrument's
    // id.unpack so useSwapInstruments resolves the instrument and the
    // hydrate path actually fires.
    const wfBase = wfPayload({
      partyA: 'Alice::ns',
      partyB: 'Bob::ns',
      notional: '10000000',
      instrumentKey: {
        depository: 'Operator::dep',
        issuer: 'Operator::iss',
        id: { unpack: 'KEY' },
        version: '0',
        holdingStandard: 'TransferableFungible',
      },
    })

    const overrides: Record<string, unknown[]> = {
      'Swap.Workflow:SwapWorkflow': [{ contractId: 'wf-1', payload: wfBase }],
      [IRS_INSTRUMENT_TEMPLATE_ID]: [{ contractId: 'instr-1', payload: irsInstr() }],
    }
    const client = {
      query: vi.fn((tpl: string) => Promise.resolve(overrides[tpl] ?? [])),
    }

    const { rerender } = renderHook(
      ({ nonce }: { nonce: number }) =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Active',
            proposalContractId: 'wf-1',
            notionalMatch: 10_000_000,
            refetchNonce: nonce,
          },
          dispatch,
        ),
      { initialProps: { nonce: 0 }, wrapper: makeWrapper() },
    )

    // Initial hydrate fires once — confirm.
    await waitFor(() => {
      const hydrates = dispatch.mock.calls.filter(
        (c) => (c[0] as { type: string }).type === 'HYDRATE_PROPOSAL_PAYLOAD',
      )
      expect(hydrates.length).toBe(1)
    })

    // Simulate Daml cid rotation: same logical workflow (same instrumentKey,
    // same parties, same notional) but new contract id. The proposalContractId
    // also rotates because the URL would track the latest cid post-mutation.
    overrides['Swap.Workflow:SwapWorkflow'] = [{ contractId: 'wf-2', payload: wfBase }]
    rerender({ nonce: 1 })

    // Wait for the refetch to land — the workflow query must have re-run.
    await waitFor(() => {
      const wfQueries = client.query.mock.calls.filter((c) => c[0] === 'Swap.Workflow:SwapWorkflow')
      expect(wfQueries.length).toBeGreaterThanOrEqual(2)
    })
    // Give the resolvedWorkflow setState + downstream effect a tick to flush.
    await new Promise((r) => setTimeout(r, 30))

    // Hydrate must still have fired exactly once — the gate suppressed the
    // re-hydrate despite the cid rotation.
    const hydratesAfter = dispatch.mock.calls.filter(
      (c) => (c[0] as { type: string }).type === 'HYDRATE_PROPOSAL_PAYLOAD',
    )
    expect(hydratesAfter.length).toBe(1)
  })

  test('different logical workflow (different instrumentKey) DOES re-fire hydrate', async () => {
    // Sanity: the gate must not be so coarse it suppresses hydrate for an
    // unrelated swap. Switching to a different instrument key should
    // re-hydrate.
    const dispatch = vi.fn()

    const wfA = wfPayload({
      partyA: 'Alice::ns',
      partyB: 'Bob::ns',
      notional: '10000000',
      instrumentKey: {
        depository: 'Operator::dep',
        issuer: 'Operator::iss',
        id: { unpack: 'KEY' },
        version: '0',
        holdingStandard: 'TransferableFungible',
      },
    })
    const wfB = wfPayload({
      partyA: 'Alice::ns',
      partyB: 'Bob::ns',
      notional: '5000000',
      instrumentKey: {
        depository: 'Operator::dep',
        issuer: 'Operator::iss',
        id: { unpack: 'KEY-OTHER' },
        version: '0',
        holdingStandard: 'TransferableFungible',
      },
    })

    const overrides: Record<string, unknown[]> = {
      'Swap.Workflow:SwapWorkflow': [{ contractId: 'wf-a', payload: wfA }],
      [IRS_INSTRUMENT_TEMPLATE_ID]: [
        { contractId: 'instr-a', payload: { ...irsInstr(), id: { unpack: 'KEY' } } },
        { contractId: 'instr-b', payload: { ...irsInstr(), id: { unpack: 'KEY-OTHER' } } },
      ],
    }
    const client = {
      query: vi.fn((tpl: string) => Promise.resolve(overrides[tpl] ?? [])),
    }

    const { rerender } = renderHook(
      ({ pid, nm, nonce }: { pid: string; nm: number; nonce: number }) =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Active',
            proposalContractId: pid,
            notionalMatch: nm,
            refetchNonce: nonce,
          },
          dispatch,
        ),
      {
        initialProps: { pid: 'wf-a', nm: 10_000_000, nonce: 0 },
        wrapper: makeWrapper(),
      },
    )

    await waitFor(() => {
      const hydrates = dispatch.mock.calls.filter(
        (c) => (c[0] as { type: string }).type === 'HYDRATE_PROPOSAL_PAYLOAD',
      )
      expect(hydrates.length).toBe(1)
    })

    // Switch to a different logical workflow.
    overrides['Swap.Workflow:SwapWorkflow'] = [{ contractId: 'wf-b', payload: wfB }]
    rerender({ pid: 'wf-b', nm: 5_000_000, nonce: 1 })

    await waitFor(() => {
      const hydrates = dispatch.mock.calls.filter(
        (c) => (c[0] as { type: string }).type === 'HYDRATE_PROPOSAL_PAYLOAD',
      )
      expect(hydrates.length).toBe(2)
    })
  })
})
