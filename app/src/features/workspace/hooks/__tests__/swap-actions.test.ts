import { describe, expect, test, vi } from 'vitest'
import type { LedgerClient } from '@/shared/ledger/client'
import {
  exerciseProposalChoice,
  exerciseWorkflowChoice,
  proposeSwap,
} from '../../ledger/swap-actions'

// Provide a cached config so readOperatorPolicy() doesn't hit /api/config.
// All existing tests exercise the `auto` path (no compliance gate).
vi.mock('@/shared/config/client', () => ({
  loadClientConfig: vi.fn().mockResolvedValue({
    topology: 'sandbox',
    routing: 'path',
    auth: { provider: 'demo' },
    daml: { ledgerId: 'test', applicationId: 'test' },
    orgs: [{ id: 'o', party: 'P::x', displayName: 'P', hint: 'P', ledgerUrl: 'http://x' }],
    operator: undefined,
  }),
}))

type FakeClient = Pick<LedgerClient, 'resolvePartyId' | 'create' | 'exercise'>

function fakeClient(): FakeClient & {
  resolvePartyId: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  exercise: ReturnType<typeof vi.fn>
  query: ReturnType<typeof vi.fn>
} {
  // `query` is generic on `LedgerClient` (`<T>(id) → Promise<T[]>`); our
  // mock returns a concrete array, so we assemble the object untyped and
  // cast at the return site rather than fighting the TS inference.
  return {
    resolvePartyId: vi.fn((hint: string) => Promise.resolve(`${hint}::1220deadbeef`)),
    create: vi.fn(() => Promise.resolve({ contractId: 'cid-1' })),
    exercise: vi.fn(() => Promise.resolve(undefined)),
    // Default FloatingRateIndex mock: IRS accept queries it by currency
    // and injects the CID as `floatingRateIndexCid`. Individual tests
    // override with `.mockResolvedValueOnce(...)` when they need other
    // shapes.
    query: vi.fn(() =>
      Promise.resolve([
        { contractId: 'frid-usd-sofr', payload: { currency: 'USD', indexId: 'USD-SOFR' } },
      ]),
    ),
  }
}

describe('proposeSwap', () => {
  test('IRS routes through ProposalDelegation choice (proposer-only authority)', async () => {
    const client = fakeClient()
    // IRS now goes through PROPOSAL_DELEGATION_TEMPLATE_ID → CreateSwapProposal.
    // First query is the delegation lookup; second (if any) is FloatingRateIndex.
    client.query.mockResolvedValueOnce([
      { contractId: 'pd-1', payload: { operator: 'Operator::1220deadbeef' } },
    ])
    client.exercise.mockResolvedValueOnce({ result: { exerciseResult: 'cid-1' } })
    const dates = {
      tradeDate: new Date('2026-04-12'),
      effectiveDate: new Date('2026-04-14'),
      maturityDate: new Date('2031-04-14'),
      tenor: { years: 5, months: 0 },
      anchor: 'tenor' as const,
      effManuallySet: false,
    }
    const legs = [
      {
        legType: 'fixed',
        currency: 'USD',
        notional: 1_000_000,
        rate: 0.04,
        dayCount: 'ACT_360',
        schedule: {
          startDate: dates.effectiveDate,
          endDate: dates.maturityDate,
          frequency: 'Quarterly' as const,
        },
      },
      {
        legType: 'float',
        currency: 'USD',
        notional: 1_000_000,
        indexId: 'SOFR/INDEX',
        spread: 0,
        dayCount: 'ACT_360',
        schedule: {
          startDate: dates.effectiveDate,
          endDate: dates.maturityDate,
          frequency: 'Quarterly' as const,
        },
      },
    ]

    const result = await proposeSwap(client as unknown as LedgerClient, {
      swapType: 'IRS',
      legs: legs as Parameters<typeof proposeSwap>[1]['legs'],
      dates,
      proposerHint: 'PartyA',
      counterpartyHint: 'PartyB',
    })

    expect(client.resolvePartyId).toHaveBeenCalledWith('PartyA')
    expect(client.resolvePartyId).toHaveBeenCalledWith('PartyB')
    // IRS path no longer calls client.create directly — it exercises the
    // delegation choice instead, so the trader's JWT only needs proposer.
    expect(client.create).not.toHaveBeenCalled()
    expect(client.exercise).toHaveBeenCalledTimes(1)
    const [tpl, cid, choice, args] = client.exercise.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ]
    expect(tpl).toContain('Swap.ProposalDelegation:ProposalDelegation')
    expect(cid).toBe('pd-1')
    expect(choice).toBe('CreateSwapProposal')
    expect(args.proposer).toBe('PartyA::1220deadbeef')
    expect(args.counterparty).toBe('PartyB::1220deadbeef')
    expect(args.startDate).toBe('2026-04-14')
    expect(result).toEqual({ contractId: 'cid-1' })
  })
})

describe('exerciseProposalChoice', () => {
  test('accept returns workflowContractId from exercise response', async () => {
    const client = fakeClient()
    client.exercise.mockResolvedValueOnce({ result: { exerciseResult: 'wf-new-1' } })
    const result = await exerciseProposalChoice(client as unknown as LedgerClient, {
      swapType: 'IRS',
      proposalContractId: 'p-1',
      choiceKey: 'accept',
    })
    const [tpl, cid, choiceName, args] = client.exercise.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ]
    expect(tpl).toBe('Swap.Proposal:SwapProposal')
    expect(cid).toBe('p-1')
    expect(choiceName).toBe('Accept')
    expect(args.operator).toBe('Operator::1220deadbeef')
    // Phase-3: IRS accept now wires a FloatingRateIndex CID looked up
    // from the ledger by currency (default USD).
    expect(args.floatingRateIndexCid).toBe('frid-usd-sofr')
    expect(result.workflowContractId).toBe('wf-new-1')
  })

  test('IRS accept throws when no FloatingRateIndex is seeded for the currency', async () => {
    const client = fakeClient()
    client.query.mockResolvedValueOnce([])
    await expect(
      exerciseProposalChoice(client as unknown as LedgerClient, {
        swapType: 'IRS',
        proposalContractId: 'p-err',
        choiceKey: 'accept',
      }),
    ).rejects.toThrow(/No FloatingRateIndex seeded for USD/)
  })

  test('ASSET accept wires a FloatingRateIndex CID looked up by currency', async () => {
    const client = fakeClient()
    client.exercise.mockResolvedValueOnce({ result: { exerciseResult: 'wf-asset-1' } })
    await exerciseProposalChoice(client as unknown as LedgerClient, {
      swapType: 'ASSET',
      proposalContractId: 'p-asset',
      choiceKey: 'accept',
    })
    const [tpl, , choiceName, args] = client.exercise.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ]
    expect(tpl).toBe('Swap.AssetSwapProposal:AssetSwapProposal')
    expect(choiceName).toBe('AssetAccept')
    // Phase-3: ASSET accept now wires a FloatingRateIndex CID (same path
    // as IRS) so the float interest leg on the Asset instrument carries
    // the library-native lookback shift.
    expect(args.floatingRateIndexCid).toBe('frid-usd-sofr')
  })

  test('CDS accept uses CdsAccept choice name', async () => {
    const client = fakeClient()
    client.exercise.mockResolvedValueOnce({ result: { exerciseResult: 'wf-cds' } })
    await exerciseProposalChoice(client as unknown as LedgerClient, {
      swapType: 'CDS',
      proposalContractId: 'p-2',
      choiceKey: 'accept',
    })
    const [, , choiceName] = client.exercise.mock.calls[0] as [string, string, string]
    expect(choiceName).toBe('CdsAccept')
  })

  test('reject does not inject operator/regulator and returns no workflow id', async () => {
    const client = fakeClient()
    client.exercise.mockResolvedValueOnce({ result: { exerciseResult: null } })
    const result = await exerciseProposalChoice(client as unknown as LedgerClient, {
      swapType: 'IRS',
      proposalContractId: 'p-3',
      choiceKey: 'reject',
    })
    expect(client.resolvePartyId).not.toHaveBeenCalledWith('Operator')
    expect(result.workflowContractId).toBeUndefined()
  })
})

describe('exerciseWorkflowChoice', () => {
  test('TriggerLifecycle targets SwapWorkflow template with workflow contractId', async () => {
    const client = fakeClient()
    await exerciseWorkflowChoice(client as unknown as LedgerClient, {
      workflowContractId: 'wf-1',
      choice: 'TriggerLifecycle',
      args: { lifecycleRuleCid: 'r-1', eventCid: 'e-1', observableCids: ['o-1'] },
    })
    const [tpl, cid, choiceName, args] = client.exercise.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ]
    expect(tpl).toBe('Swap.Workflow:SwapWorkflow')
    expect(cid).toBe('wf-1')
    expect(choiceName).toBe('TriggerLifecycle')
    expect(args).toEqual({ lifecycleRuleCid: 'r-1', eventCid: 'e-1', observableCids: ['o-1'] })
  })

  test('throws if workflowContractId missing', async () => {
    const client = fakeClient()
    await expect(
      exerciseWorkflowChoice(client as unknown as LedgerClient, {
        workflowContractId: null,
        choice: 'Settle',
        args: {},
      }),
    ).rejects.toThrow(/workflow contract id/i)
  })
})
