import { describe, expect, test, vi } from 'vitest'

import type { LedgerClient } from '@/shared/ledger/client'
import { EFFECT_TEMPLATE_ID, TRANSFERABLE_FUNGIBLE_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import {
  resolveMatureInputs,
  resolveSettlementInputs,
  resolveTerminateInputs,
} from '../settlement-inputs'

vi.mock('@/shared/ledger/generated/package-ids', () => ({
  IRSFORGE_PACKAGE_ID: 'test-irsforge-pkg',
  DAML_FINANCE_DATA_PACKAGE_ID: 'test-daml-finance-data-pkg',
  DAML_FINANCE_LIFECYCLE_PACKAGE_ID: 'test-daml-finance-lifecycle-pkg',
  DAML_FINANCE_HOLDING_PACKAGE_ID: 'test-daml-finance-holding-pkg',
  DAML_FINANCE_CLAIMS_PACKAGE_ID: 'test-daml-finance-claims-pkg',
  DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID: 'test-daml-finance-instrument-swap-pkg',
}))

function fakeClient(overrides: Record<string, unknown[]> = {}): Pick<LedgerClient, 'query'> {
  return {
    query: vi.fn((tpl: string) => Promise.resolve(overrides[tpl] ?? [])) as LedgerClient['query'],
  }
}

const usdInstrumentKey = {
  depository: 'Op::ns',
  issuer: 'Op::ns',
  id: { unpack: 'USD' },
  version: '0',
  holdingStandard: 'TransferableFungible',
}

const cashRecord = {
  contractId: 'cash-1',
  payload: {
    operator: 'Operator::ns',
    partyA: 'PartyA::ns',
    partyB: 'PartyB::ns',
    regulators: ['Reg::ns'],
    lifecycleRuleCid: 'lr-1',
    eventFactoryCid: 'ef-1',
    settlementFactoryCid: 'sf-1',
    routeProviderCid: 'rp-1',
    partyAAccountKey: { custodian: 'Op::ns', owner: 'PartyA::ns', id: { unpack: 'acct-A' } },
    partyBAccountKey: { custodian: 'Op::ns', owner: 'PartyB::ns', id: { unpack: 'acct-B' } },
    currencies: [['USD', usdInstrumentKey]] as [string, typeof usdInstrumentKey][],
    defaultCurrencyCode: 'USD',
    factories: {
      irs: 'f-irs',
      cds: 'f-cds',
      ccy: 'f-ccy',
      fx: 'f-fx',
      asset: 'f-asset',
      fpml: 'f-fpml',
    },
    scheduleDefaults: [],
    cdsReferenceNames: [],
  },
}

const effectForUsd = (cid: string) => ({
  contractId: cid,
  payload: {
    provider: 'Operator::ns',
    targetInstrument: usdInstrumentKey,
    producedQuantities: [{ unit: usdInstrumentKey, amount: '1000.0' }],
    consumedQuantities: [],
    settlementDate: '2026-07-16',
  },
})

const holdingFor = (cid: string, owner: string, amount: string) => ({
  contractId: cid,
  payload: {
    instrument: usdInstrumentKey,
    account: {
      custodian: 'Op::ns',
      owner,
      id: { unpack: `acct-${owner.split('::')[0].slice(-1)}` },
    },
    amount,
    lock: null,
  },
})

describe('resolveTerminateInputs — additional branches', () => {
  test('picks largest USD holding when a party has multiple', async () => {
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [
        holdingFor('h-A-small', 'PartyA::ns', '500.0'),
        holdingFor('h-A-big', 'PartyA::ns', '9999.0'),
        holdingFor('h-B', 'PartyB::ns', '1000.0'),
      ],
    })
    const result = await resolveTerminateInputs(client as LedgerClient, {
      proposer: 'PartyA::ns',
      counterparty: 'PartyB::ns',
    })
    expect(result.proposerHoldingCid).toBe('h-A-big')
  })

  test('swaps account keys when proposer is PartyB', async () => {
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [
        holdingFor('h-A', 'PartyA::ns', '1000.0'),
        holdingFor('h-B', 'PartyB::ns', '1000.0'),
      ],
    })
    const result = await resolveTerminateInputs(client as LedgerClient, {
      proposer: 'PartyB::ns',
      counterparty: 'PartyA::ns',
    })
    expect(result.proposerAccountKey.id.unpack).toBe('acct-B')
    expect(result.counterpartyAccountKey.id.unpack).toBe('acct-A')
    expect(result.proposerHoldingCid).toBe('h-B')
    expect(result.counterpartyHoldingCid).toBe('h-A')
  })
})

describe('resolveSettlementInputs / resolveMatureInputs — additional branches', () => {
  test('resolveSettlementInputs picks largest USD holding per party', async () => {
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [EFFECT_TEMPLATE_ID]: [effectForUsd('e-1')],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [
        holdingFor('h-A-lo', 'PartyA::ns', '100.0'),
        holdingFor('h-A-hi', 'PartyA::ns', '900.0'),
        holdingFor('h-B-lo', 'PartyB::ns', '50.0'),
        holdingFor('h-B-hi', 'PartyB::ns', '5000.0'),
      ],
    })
    const result = await resolveSettlementInputs(client as LedgerClient, {
      workflowContractId: 'wf-1',
      partyA: 'PartyA',
      partyB: 'PartyB',
    })
    expect(result.partyAHoldingCid).toBe('h-A-hi')
    expect(result.partyBHoldingCid).toBe('h-B-hi')
  })

  test('resolveMatureInputs picks largest USD holding per party', async () => {
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [EFFECT_TEMPLATE_ID]: [effectForUsd('e-1')],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [
        holdingFor('h-A-lo', 'PartyA::ns', '100.0'),
        holdingFor('h-A-hi', 'PartyA::ns', '900.0'),
        holdingFor('h-B', 'PartyB::ns', '5000.0'),
      ],
    })
    const result = await resolveMatureInputs(client as LedgerClient, {
      workflowContractId: 'wf-1',
      partyA: 'PartyA',
      partyB: 'PartyB',
    })
    expect(result.partyAHoldingCid).toBe('h-A-hi')
    expect(result.partyBHoldingCid).toBe('h-B')
  })

  test('resolveSettlementInputs accepts effect with only otherProduced field (lifecycle-v4)', async () => {
    const newShapeEffect = {
      contractId: 'e-new',
      payload: {
        provider: 'Operator::ns',
        targetInstrument: usdInstrumentKey,
        otherProduced: [{ unit: usdInstrumentKey, amount: '500.0' }],
        otherConsumed: [],
        settlementDate: '2026-07-16',
      },
    }
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [EFFECT_TEMPLATE_ID]: [newShapeEffect],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [
        holdingFor('h-A', 'PartyA::ns', '1000.0'),
        holdingFor('h-B', 'PartyB::ns', '1000.0'),
      ],
    })
    const result = await resolveSettlementInputs(client as LedgerClient, {
      workflowContractId: 'wf',
      partyA: 'PartyA',
      partyB: 'PartyB',
    })
    expect(result.effectCids).toEqual(['e-new'])
  })
})
