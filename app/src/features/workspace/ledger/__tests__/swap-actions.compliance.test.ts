import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { LedgerClient } from '@/shared/ledger/client'

// Must be declared before imports that use the module (vi.mock hoisting)
vi.mock('@/shared/ledger/generated/package-ids', () => ({
  IRSFORGE_PACKAGE_ID: 'test-irsforge-pkg',
  DAML_FINANCE_DATA_PACKAGE_ID: 'test-df-data-pkg',
  DAML_FINANCE_LIFECYCLE_PACKAGE_ID: 'test-df-lifecycle-pkg',
  DAML_FINANCE_HOLDING_PACKAGE_ID: 'test-df-holding-pkg',
  DAML_FINANCE_CLAIMS_PACKAGE_ID: 'test-df-claims-pkg',
  DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID: 'test-df-swap-pkg',
}))

import { exerciseProposalChoice } from '../swap-actions'

const OPERATOR_POLICY_TEMPLATE_FRAGMENT = 'Operator.Policy:OperatorPolicy'

type PolicyMap = Partial<Record<string, 'auto' | 'manual'>>

function policyRowsFor(policy: PolicyMap): Array<{
  contractId: string
  payload: {
    operator: string
    regulators: string[]
    traders: string[]
    family: string
    mode: 'Auto' | 'Manual'
  }
}> {
  return Object.entries(policy).map(([family, mode]) => ({
    contractId: `policy-${family}`,
    payload: {
      operator: 'Operator::fp',
      regulators: ['Regulator::fp'],
      traders: ['Alice::fp', 'Bob::fp'],
      family,
      mode: mode === 'manual' ? ('Manual' as const) : ('Auto' as const),
    },
  }))
}

interface MakeClientOpts {
  policy?: PolicyMap
  fri?: Array<{ contractId: string; payload: { currency: string; indexId: string } }>
  resolvePartyId?: (hint: string) => Promise<string>
  exercise?: ReturnType<typeof vi.fn>
}

function makeClient(opts: MakeClientOpts = {}): LedgerClient {
  const resolvePartyId = opts.resolvePartyId ?? ((hint: string) => Promise.resolve(`${hint}::fp`))
  const exercise =
    opts.exercise ??
    vi.fn().mockResolvedValue({ result: { exerciseResult: 'wf-cid-1', events: [] } })
  const friRows = opts.fri ?? [
    { contractId: 'fri-cid-1', payload: { currency: 'USD', indexId: 'USD-SOFR' } },
  ]
  const policyRows = policyRowsFor(opts.policy ?? {})
  const query = vi.fn((templateId: string) => {
    if (templateId.includes(OPERATOR_POLICY_TEMPLATE_FRAGMENT)) {
      return Promise.resolve(policyRows)
    }
    return Promise.resolve(friRows)
  })
  return {
    resolvePartyId: vi.fn(resolvePartyId),
    exercise,
    query,
    create: vi.fn(),
  } as unknown as LedgerClient
}

describe('exerciseProposalChoice — compliance gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('IRS + policy=auto → calls Accept with operator widened (existing behavior)', async () => {
    const exercise = vi
      .fn()
      .mockResolvedValue({ result: { exerciseResult: 'wf-auto', events: [] } })
    const client = makeClient({ policy: { IRS: 'auto' }, exercise })

    const result = await exerciseProposalChoice(client, {
      swapType: 'IRS',
      proposalContractId: 'prop-cid-1',
      choiceKey: 'accept',
    })

    expect(exercise).toHaveBeenCalledTimes(1)
    const [, , choiceName, choiceArgs] = exercise.mock.calls[0]
    expect(choiceName).toBe('Accept')
    // operator arg must be present (widened actAs path)
    expect(choiceArgs).toHaveProperty('operator')
    expect(result.workflowContractId).toBe('wf-auto')
  })

  test('IRS + policy=manual → calls IrsProposeAccept without widening actAs', async () => {
    const exercise = vi.fn().mockResolvedValue({ result: { exerciseResult: null, events: [] } })
    const client = makeClient({ policy: { IRS: 'manual' }, exercise })

    const result = await exerciseProposalChoice(client, {
      swapType: 'IRS',
      proposalContractId: 'prop-cid-2',
      choiceKey: 'accept',
    })

    expect(exercise).toHaveBeenCalledTimes(1)
    const [, , choiceName, choiceArgs] = exercise.mock.calls[0]
    expect(choiceName).toBe('IrsProposeAccept')
    // Must carry operator, regulator, floatingRateIndexCid as per Daml choice args
    expect(choiceArgs).toHaveProperty('operator')
    expect(choiceArgs).toHaveProperty('regulators')
    expect(choiceArgs).toHaveProperty('floatingRateIndexCid')
    // workflowContractId must be undefined — no workflow is created yet
    expect(result.workflowContractId).toBeUndefined()
  })

  test('CDS + IRS-only-manual-policy → uses CdsAccept (not CdsProposeAccept)', async () => {
    // Policy is manual for IRS only; CDS defaults to auto → still direct CdsAccept
    const exercise = vi.fn().mockResolvedValue({ result: { exerciseResult: 'wf-cds', events: [] } })
    const client = makeClient({ policy: { IRS: 'manual' }, exercise })

    const result = await exerciseProposalChoice(client, {
      swapType: 'CDS',
      proposalContractId: 'prop-cid-3',
      choiceKey: 'accept',
    })

    expect(exercise).toHaveBeenCalledTimes(1)
    const [, , choiceName] = exercise.mock.calls[0]
    expect(choiceName).toBe('CdsAccept')
    expect(result.workflowContractId).toBe('wf-cds')
  })

  test('CDS + policy=manual for CDS → calls CdsProposeAccept (no index cid)', async () => {
    const exercise = vi.fn().mockResolvedValue({ result: { exerciseResult: null, events: [] } })
    const client = makeClient({ policy: { CDS: 'manual' }, exercise })

    const result = await exerciseProposalChoice(client, {
      swapType: 'CDS',
      proposalContractId: 'prop-cid-cds-manual',
      choiceKey: 'accept',
    })

    expect(exercise).toHaveBeenCalledTimes(1)
    const [, , choiceName, choiceArgs] = exercise.mock.calls[0]
    expect(choiceName).toBe('CdsProposeAccept')
    expect(choiceArgs).toHaveProperty('operator')
    expect(choiceArgs).toHaveProperty('regulators')
    // CDS has no floatingRateIndexCid
    expect(choiceArgs).not.toHaveProperty('floatingRateIndexCid')
    expect(result.workflowContractId).toBeUndefined()
  })

  test('BASIS + policy=manual → calls BasisProposeAccept with two index cids', async () => {
    const exercise = vi.fn().mockResolvedValue({ result: { exerciseResult: null, events: [] } })
    const client = makeClient({
      policy: { BASIS: 'manual' },
      exercise,
      fri: [
        { contractId: 'fri-sofr', payload: { currency: 'USD', indexId: 'USD-SOFR' } },
        { contractId: 'fri-effr', payload: { currency: 'USD', indexId: 'USD-EFFR' } },
      ],
    })

    const result = await exerciseProposalChoice(client, {
      swapType: 'BASIS',
      proposalContractId: 'prop-cid-basis-manual',
      choiceKey: 'accept',
    })

    expect(exercise).toHaveBeenCalledTimes(1)
    const [, , choiceName, choiceArgs] = exercise.mock.calls[0]
    expect(choiceName).toBe('BasisProposeAccept')
    expect(choiceArgs).toHaveProperty('operator')
    expect(choiceArgs).toHaveProperty('regulators')
    expect(choiceArgs).toHaveProperty('leg0FloatingRateIndexCid')
    expect(choiceArgs).toHaveProperty('leg1FloatingRateIndexCid')
    expect(result.workflowContractId).toBeUndefined()
  })

  test('IRS + no policy contract → defaults to auto (Accept choice)', async () => {
    const exercise = vi
      .fn()
      .mockResolvedValue({ result: { exerciseResult: 'wf-default', events: [] } })
    const client = makeClient({ policy: {}, exercise })

    await exerciseProposalChoice(client, {
      swapType: 'IRS',
      proposalContractId: 'prop-cid-4',
      choiceKey: 'accept',
    })

    const [, , choiceName] = exercise.mock.calls[0]
    expect(choiceName).toBe('Accept')
  })

  test('IRS + reject → policy not consulted, uses Reject choice', async () => {
    const exercise = vi.fn().mockResolvedValue({ result: { exerciseResult: null, events: [] } })
    const client = makeClient({ policy: { IRS: 'manual' }, exercise })

    await exerciseProposalChoice(client, {
      swapType: 'IRS',
      proposalContractId: 'prop-cid-5',
      choiceKey: 'reject',
    })

    const [, , choiceName] = exercise.mock.calls[0]
    expect(choiceName).not.toBe('IrsProposeAccept')
    expect(choiceName).toBe('Reject')
  })
})
