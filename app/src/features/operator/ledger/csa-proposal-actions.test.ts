import { describe, expect, test, vi } from 'vitest'
import type { LedgerClient } from '@/shared/ledger/client'
import { CSA_PROPOSAL_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import { exerciseCsaProposalChoice, proposeCsa } from './csa-proposal-actions'

// Minimal mock of LedgerClient — only the methods under test.
function makeMockClient(
  partyMap: Record<string, string> = {},
  createResult: { contractId: string } = { contractId: 'CsaProposal#1' },
  exerciseResult: unknown = {},
): LedgerClient {
  const resolvePartyId = vi.fn((hint: string) =>
    Promise.resolve(partyMap[hint] ?? `${hint}::fingerprint`),
  )
  const create = vi.fn(() => Promise.resolve(createResult))
  const exercise = vi.fn(() => Promise.resolve(exerciseResult))

  return {
    resolvePartyId,
    create,
    exercise,
  } as unknown as LedgerClient
}

const BASE_ARGS = {
  proposerHint: 'BankA',
  counterpartyHint: 'BankB',
  thresholdDirA: 1_000_000,
  thresholdDirB: 800_000,
  mta: 50_000,
  rounding: 1_000,
  eligible: [{ currency: 'USD', haircut: '0.05' }],
  valuationCcy: 'USD',
  isdaMasterAgreementRef: 'ISDA-2002-DEMO',
  governingLaw: 'NewYork' as const,
  imAmount: 0,
}

describe('proposeCsa', () => {
  test('resolves proposer, counterparty, operator, regulator parties', async () => {
    const client = makeMockClient()
    await proposeCsa(client, BASE_ARGS)
    expect(client.resolvePartyId).toHaveBeenCalledWith('BankA')
    expect(client.resolvePartyId).toHaveBeenCalledWith('BankB')
    expect(client.resolvePartyId).toHaveBeenCalledWith('Operator')
    expect(client.resolvePartyId).toHaveBeenCalledWith('Regulator')
  })

  test('calls create with correct templateId, payload, and actAs', async () => {
    const partyMap = {
      BankA: 'BankA::abc',
      BankB: 'BankB::abc',
      Operator: 'Operator::abc',
      Regulator: 'Regulator::abc',
    }
    const client = makeMockClient(partyMap)
    await proposeCsa(client, BASE_ARGS)

    expect(client.create).toHaveBeenCalledWith(
      CSA_PROPOSAL_TEMPLATE_ID,
      {
        operator: 'Operator::abc',
        regulators: ['Regulator::abc'],
        proposer: 'BankA::abc',
        counterparty: 'BankB::abc',
        thresholdDirA: '1000000',
        thresholdDirB: '800000',
        mta: '50000',
        rounding: '1000',
        eligible: [{ currency: 'USD', haircut: '0.05' }],
        valuationCcy: 'USD',
        isdaMasterAgreementRef: 'ISDA-2002-DEMO',
        governingLaw: 'NewYork',
        imAmount: '0',
      },
      { actAs: ['BankA::abc', 'Operator::abc'] },
    )
  })

  test('returns the contractId from the create result', async () => {
    const client = makeMockClient({}, { contractId: 'CsaProposal#42' })
    const result = await proposeCsa(client, BASE_ARGS)
    expect(result).toEqual({ contractId: 'CsaProposal#42' })
  })
})

describe('exerciseCsaProposalChoice', () => {
  test('accept — resolves Scheduler and calls exercise with CsaProposalAccept + scheduler arg', async () => {
    const partyMap = { Scheduler: 'Scheduler::xyz' }
    const client = makeMockClient(partyMap)
    await exerciseCsaProposalChoice(client, 'CsaProposal#1', 'accept')

    expect(client.resolvePartyId).toHaveBeenCalledWith('Scheduler')
    expect(client.exercise).toHaveBeenCalledWith(
      CSA_PROPOSAL_TEMPLATE_ID,
      'CsaProposal#1',
      'CsaProposalAccept',
      { scheduler: 'Scheduler::xyz' },
    )
  })

  test('reject — calls exercise with CsaProposalReject and empty args', async () => {
    const client = makeMockClient()
    await exerciseCsaProposalChoice(client, 'CsaProposal#1', 'reject')

    expect(client.exercise).toHaveBeenCalledWith(
      CSA_PROPOSAL_TEMPLATE_ID,
      'CsaProposal#1',
      'CsaProposalReject',
      {},
    )
  })

  test('withdraw — calls exercise with CsaProposalWithdraw and empty args', async () => {
    const client = makeMockClient()
    await exerciseCsaProposalChoice(client, 'CsaProposal#1', 'withdraw')

    expect(client.exercise).toHaveBeenCalledWith(
      CSA_PROPOSAL_TEMPLATE_ID,
      'CsaProposal#1',
      'CsaProposalWithdraw',
      {},
    )
  })
})
