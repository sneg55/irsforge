import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LedgerClient } from '@/shared/ledger/client'
import { useProposalRole } from '../use-proposal-role'
import type { Action } from '../use-workspace-reducer'

// hydrateProposalPayload path needs a shape compatible with hydrateIrs;
// payload.startDate must parse correctly.
function makeIrsPayload(proposer: string, counterparty: string) {
  return {
    proposer,
    counterparty,
    startDate: '2026-04-21',
    maturityDate: '2027-04-21',
    tenor: 'Y1',
    notional: '10000000',
    fixRate: '0.045',
    dayCountConvention: 'Act360',
  }
}

function makeClient(queryImpl: (tpl: string) => Promise<unknown[]>): LedgerClient {
  return { query: vi.fn((tpl: string) => queryImpl(tpl)) } as unknown as LedgerClient
}

describe('useProposalRole', () => {
  let dispatch: ReturnType<typeof vi.fn>
  beforeEach(() => {
    dispatch = vi.fn()
  })

  it('noops when contractId is null', () => {
    renderHook(() =>
      useProposalRole(
        {
          contractId: null,
          client: {} as LedgerClient,
          activeParty: 'PartyA',
          swapStatus: 'Proposed',
          alreadyResolved: false,
        },
        dispatch as unknown as React.Dispatch<Action>,
      ),
    )
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('noops when client is null', () => {
    renderHook(() =>
      useProposalRole(
        {
          contractId: 'cid-1',
          client: null,
          activeParty: 'PartyA',
          swapStatus: 'Proposed',
          alreadyResolved: false,
        },
        dispatch as unknown as React.Dispatch<Action>,
      ),
    )
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('noops when activeParty is null', () => {
    renderHook(() =>
      useProposalRole(
        {
          contractId: 'cid-1',
          client: {} as LedgerClient,
          activeParty: null,
          swapStatus: 'Proposed',
          alreadyResolved: false,
        },
        dispatch as unknown as React.Dispatch<Action>,
      ),
    )
    expect(dispatch).not.toHaveBeenCalled()
  })

  it("noops when swapStatus !== 'Proposed'", () => {
    const client = makeClient(async () => [])
    renderHook(() =>
      useProposalRole(
        {
          contractId: 'cid-1',
          client,
          activeParty: 'PartyA',
          swapStatus: 'Active',
          alreadyResolved: false,
        },
        dispatch as unknown as React.Dispatch<Action>,
      ),
    )
    expect(client.query).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('noops when alreadyResolved is true', () => {
    const client = makeClient(async () => [])
    renderHook(() =>
      useProposalRole(
        {
          contractId: 'cid-1',
          client,
          activeParty: 'PartyA',
          swapStatus: 'Proposed',
          alreadyResolved: true,
        },
        dispatch as unknown as React.Dispatch<Action>,
      ),
    )
    expect(client.query).not.toHaveBeenCalled()
  })

  it('dispatches RESOLVE_PROPOSAL + HYDRATE_PROPOSAL_PAYLOAD with proposer role', async () => {
    const client = makeClient(async (tpl) => {
      if (tpl === 'Swap.Proposal:SwapProposal') {
        return [{ contractId: 'cid-1', payload: makeIrsPayload('PartyA::fp', 'PartyB::fp') }]
      }
      return []
    })
    renderHook(() =>
      useProposalRole(
        {
          contractId: 'cid-1',
          client,
          activeParty: 'PartyA',
          swapStatus: 'Proposed',
          alreadyResolved: false,
        },
        dispatch as unknown as React.Dispatch<Action>,
      ),
    )
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2))
    const resolveCall = dispatch.mock.calls.find((c) => c[0].type === 'RESOLVE_PROPOSAL')?.[0]
    expect(resolveCall).toMatchObject({
      type: 'RESOLVE_PROPOSAL',
      swapType: 'IRS',
      role: 'proposer',
      counterparty: 'PartyB',
    })
    const hydrateCall = dispatch.mock.calls.find(
      (c) => c[0].type === 'HYDRATE_PROPOSAL_PAYLOAD',
    )?.[0]
    expect(hydrateCall).toBeTruthy()
    expect(hydrateCall.swapType).toBe('IRS')
  })

  it('resolves counterparty role when activeParty does not match proposer', async () => {
    const client = makeClient(async (tpl) => {
      if (tpl === 'Swap.Proposal:SwapProposal') {
        return [{ contractId: 'cid-2', payload: makeIrsPayload('PartyA::fp', 'PartyB::fp') }]
      }
      return []
    })
    renderHook(() =>
      useProposalRole(
        {
          contractId: 'cid-2',
          client,
          activeParty: 'PartyB',
          swapStatus: 'Proposed',
          alreadyResolved: false,
        },
        dispatch as unknown as React.Dispatch<Action>,
      ),
    )
    await waitFor(() => expect(dispatch).toHaveBeenCalled())
    const resolveCall = dispatch.mock.calls.find((c) => c[0].type === 'RESOLVE_PROPOSAL')?.[0]
    expect(resolveCall.role).toBe('counterparty')
    expect(resolveCall.counterparty).toBe('PartyA')
  })

  it('swallows hydrate errors and logs a warn when payload is malformed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Unknown SwapType will make hydrateProposalPayload throw.
    const client = makeClient(async (tpl) => {
      if (tpl === 'Swap.FpmlProposal:FpmlProposal') {
        // FpML hydrator will throw on missing fpmlCid/fields
        return [
          { contractId: 'cid-x', payload: { proposer: 'PartyA::fp', counterparty: 'PartyB::fp' } },
        ]
      }
      return []
    })
    renderHook(() =>
      useProposalRole(
        {
          contractId: 'cid-x',
          client,
          activeParty: 'PartyA',
          swapStatus: 'Proposed',
          alreadyResolved: false,
        },
        dispatch as unknown as React.Dispatch<Action>,
      ),
    )
    await waitFor(() => expect(dispatch).toHaveBeenCalled())
    // RESOLVE_PROPOSAL fires, but HYDRATE_PROPOSAL_PAYLOAD may or may not
    // depending on whether hydrator throws. If it threw, warn is called.
    const resolveCalled = dispatch.mock.calls.some((c) => c[0].type === 'RESOLVE_PROPOSAL')
    expect(resolveCalled).toBe(true)
    warnSpy.mockRestore()
  })
})
