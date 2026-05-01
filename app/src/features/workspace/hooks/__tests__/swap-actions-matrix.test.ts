import { describe, expect, test, vi } from 'vitest'
import type { LedgerClient } from '@/shared/ledger/client'
import { PROPOSAL_CHOICES } from '../../constants'
import {
  createTerminateProposal,
  exerciseProposalChoice,
  exerciseTerminateProposalChoice,
  exerciseWorkflowChoice,
} from '../../ledger/swap-actions'
import type { SwapType } from '../../types'
import { fakeClient } from './swap-actions-client'

// Provide a cached config so readOperatorPolicy() doesn't hit /api/config.
// All matrix tests exercise the `auto` path — no compliance gate.
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

// Expected (template, choice-name) per swap type. The ledger call fans
// into 9 templates — each one has its own Accept/Reject/Withdraw choice
// with a type-prefixed name so the Daml sandbox can disambiguate.
const ACCEPT_MATRIX: Array<{
  swapType: SwapType
  template: string
  extraArgs?: string[]
}> = [
  { swapType: 'IRS', template: 'Swap.Proposal:SwapProposal', extraArgs: ['floatingRateIndexCid'] },
  {
    swapType: 'OIS',
    template: 'Swap.OisProposal:OisProposal',
    extraArgs: ['floatingRateIndexCid'],
  },
  {
    swapType: 'BASIS',
    template: 'Swap.BasisSwapProposal:BasisSwapProposal',
    extraArgs: ['leg0FloatingRateIndexCid', 'leg1FloatingRateIndexCid'],
  },
  {
    swapType: 'XCCY',
    template: 'Swap.XccyFixedFloatProposal:XccyFixedFloatProposal',
    extraArgs: ['floatFloatingRateIndexCid'],
  },
  { swapType: 'CDS', template: 'Swap.CdsProposal:CdsProposal' },
  { swapType: 'CCY', template: 'Swap.CcySwapProposal:CcySwapProposal' },
  { swapType: 'FX', template: 'Swap.FxSwapProposal:FxSwapProposal' },
  {
    swapType: 'ASSET',
    template: 'Swap.AssetSwapProposal:AssetSwapProposal',
    extraArgs: ['floatingRateIndexCid'],
  },
  { swapType: 'FpML', template: 'Swap.FpmlProposal:FpmlProposal' },
]

describe('exerciseProposalChoice — accept matrix (all 9 swap types)', () => {
  test.each(
    ACCEPT_MATRIX,
  )('$swapType accept targets $template and injects operator+regulator', async ({
    swapType,
    template,
    extraArgs,
  }) => {
    const client = fakeClient()
    client.exercise.mockResolvedValueOnce({ result: { exerciseResult: `wf-${swapType}` } })
    const result = await exerciseProposalChoice(client as unknown as LedgerClient, {
      swapType,
      proposalContractId: `p-${swapType}`,
      choiceKey: 'accept',
    })
    const [tpl, cid, choiceName, args] = client.exercise.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ]
    expect(tpl).toBe(template)
    expect(cid).toBe(`p-${swapType}`)
    expect(choiceName).toBe(PROPOSAL_CHOICES[swapType].accept)
    expect(args.operator).toBe('Operator::1220deadbeef')
    expect(args.regulators).toEqual(['Regulator::1220deadbeef'])
    for (const k of extraArgs ?? []) {
      expect(args[k]).toEqual(expect.any(String))
    }
    expect(result.workflowContractId).toBe(`wf-${swapType}`)
  })
})

describe('exerciseProposalChoice — reject + withdraw matrix (all 9 types)', () => {
  test.each(
    ACCEPT_MATRIX.flatMap(({ swapType, template }) => [
      { swapType, template, choiceKey: 'reject' as const },
      { swapType, template, choiceKey: 'withdraw' as const },
    ]),
  )('$swapType $choiceKey targets $template with no operator injection', async ({
    swapType,
    template,
    choiceKey,
  }) => {
    const client = fakeClient()
    client.exercise.mockResolvedValueOnce({ result: { exerciseResult: null } })
    const result = await exerciseProposalChoice(client as unknown as LedgerClient, {
      swapType,
      proposalContractId: `p-${swapType}-${choiceKey}`,
      choiceKey,
    })
    const [tpl, , choiceName, args] = client.exercise.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ]
    expect(tpl).toBe(template)
    expect(choiceName).toBe(PROPOSAL_CHOICES[swapType][choiceKey])
    expect(client.resolvePartyId).not.toHaveBeenCalledWith('Operator')
    expect(client.resolvePartyId).not.toHaveBeenCalledWith('Regulator')
    // No floatingRateIndexCid injection on non-accept paths.
    expect('floatingRateIndexCid' in args).toBe(false)
    expect('leg0FloatingRateIndexCid' in args).toBe(false)
    expect(result.workflowContractId).toBeUndefined()
  })
})

describe('exerciseProposalChoice — BASIS accept threads two distinct indices', () => {
  test('BasisAccept carries leg0 + leg1 FloatingRateIndex cids', async () => {
    const client = fakeClient()
    client.exercise.mockResolvedValueOnce({ result: { exerciseResult: 'wf-basis' } })
    await exerciseProposalChoice(client as unknown as LedgerClient, {
      swapType: 'BASIS',
      proposalContractId: 'p-basis',
      choiceKey: 'accept',
    })
    const [, , , args] = client.exercise.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ]
    // Both must be present; the Daml Accept body requires distinct cids so
    // the two float legs can project off different indices.
    expect(typeof args.leg0FloatingRateIndexCid).toBe('string')
    expect(typeof args.leg1FloatingRateIndexCid).toBe('string')
  })

  test('BASIS accept throws when a required indexId is not seeded', async () => {
    const client = fakeClient()
    // Return only USD-SOFR; leg1 needs USD-EFFR (or whatever default) and
    // should not resolve — the helper throws.
    client.query.mockResolvedValueOnce([
      { contractId: 'frid-usd-sofr', payload: { currency: 'USD', indexId: 'USD-SOFR' } },
    ])
    client.query.mockResolvedValueOnce([
      { contractId: 'frid-usd-sofr', payload: { currency: 'USD', indexId: 'USD-SOFR' } },
    ])
    await expect(
      exerciseProposalChoice(client as unknown as LedgerClient, {
        swapType: 'BASIS',
        proposalContractId: 'p-b-err',
        choiceKey: 'accept',
      }),
    ).rejects.toThrow(/FloatingRateIndex.*indexId/)
  })
})

describe('exerciseWorkflowChoice — Settle, Mature, Terminate', () => {
  test.each([
    'Settle',
    'Mature',
    'Terminate',
  ] as const)('%s targets SwapWorkflow template', async (choice) => {
    const client = fakeClient()
    await exerciseWorkflowChoice(client as unknown as LedgerClient, {
      workflowContractId: 'wf-1',
      choice,
      args: { marker: choice },
    })
    const [tpl, cid, choiceName, args] = client.exercise.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ]
    expect(tpl).toBe('Swap.Workflow:SwapWorkflow')
    expect(cid).toBe('wf-1')
    expect(choiceName).toBe(choice)
    expect(args).toEqual({ marker: choice })
  })
})

describe('createTerminateProposal', () => {
  test('creates a TerminateProposal with stringified PV and ISO proposedAt', async () => {
    const client = fakeClient()
    client.create.mockResolvedValueOnce({ contractId: 'tp-1' })
    const result = await createTerminateProposal(client as unknown as LedgerClient, {
      operator: 'Operator::x',
      proposer: 'PartyA::x',
      counterparty: 'PartyB::x',
      regulators: ['Regulator::x'],
      workflowContractId: 'wf-1',
      proposedPvAmount: 12345.678,
      reason: 'mark-to-market unwind',
    })
    expect(result.contractId).toBe('tp-1')
    const [tpl, payload] = client.create.mock.calls[0] as [string, Record<string, unknown>]
    expect(tpl).toBe('Swap.Terminate:TerminateProposal')
    expect(payload.workflowCid).toBe('wf-1')
    expect(payload.proposedPvAmount).toBe('12345.68')
    expect(payload.reason).toBe('mark-to-market unwind')
    expect(typeof payload.proposedAt).toBe('string')
    expect((payload.proposedAt as string).endsWith('Z')).toBe(true)
  })
})

describe('exerciseTerminateProposalChoice', () => {
  test.each([
    'TpAccept',
    'TpReject',
    'TpWithdraw',
  ] as const)('%s targets the TerminateProposal template with given cid + args', async (choice) => {
    const client = fakeClient()
    client.exercise.mockResolvedValueOnce({ result: { exerciseResult: 'unwind-out' } })
    await exerciseTerminateProposalChoice(client as unknown as LedgerClient, {
      proposalCid: 'tp-42',
      choice,
      args: { flag: choice },
    })
    const [tpl, cid, choiceName, args] = client.exercise.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ]
    expect(tpl).toBe('Swap.Terminate:TerminateProposal')
    expect(cid).toBe('tp-42')
    expect(choiceName).toBe(choice)
    expect(args).toEqual({ flag: choice })
  })
})
