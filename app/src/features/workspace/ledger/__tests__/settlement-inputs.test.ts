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

// New-shape CashSetupRecord: `currencies` is a tuple-array (Canton v1 Map),
// `defaultCurrencyCode` points at the default entry, `factories` holds the
// six per-family instrument factory cids.
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

describe('resolveSettlementInputs', () => {
  test('happy path composes all 7 args from ledger queries', async () => {
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [EFFECT_TEMPLATE_ID]: [effectForUsd('e-1')],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [
        holdingFor('h-A', 'PartyA::ns', '1000000.0'),
        holdingFor('h-B', 'PartyB::ns', '1000000.0'),
      ],
    })
    const result = await resolveSettlementInputs(client as LedgerClient, {
      workflowContractId: 'wf-1',
      partyA: 'PartyA',
      partyB: 'PartyB',
    })
    expect(result.effectCids).toEqual(['e-1'])
    expect(result.settlementFactoryCid).toBe('sf-1')
    expect(result.routeProviderCid).toBe('rp-1')
    expect(result.partyAHoldingCid).toBe('h-A')
    expect(result.partyBHoldingCid).toBe('h-B')
    expect(result.partyAAccountKey.id.unpack).toBe('acct-A')
    expect(result.partyBAccountKey.id.unpack).toBe('acct-B')
    expect(result.usdInstrumentKey.id.unpack).toBe('USD')
  })

  test('throws when CashSetupRecord missing', async () => {
    const client = fakeClient({})
    await expect(
      resolveSettlementInputs(client as LedgerClient, {
        workflowContractId: 'wf',
        partyA: 'PartyA',
        partyB: 'PartyB',
      }),
    ).rejects.toThrow(/cash infrastructure not provisioned/i)
  })

  test('throws when no effects to settle', async () => {
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [EFFECT_TEMPLATE_ID]: [],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [
        holdingFor('h-A', 'PartyA::ns', '1000000.0'),
        holdingFor('h-B', 'PartyB::ns', '1000000.0'),
      ],
    })
    await expect(
      resolveSettlementInputs(client as LedgerClient, {
        workflowContractId: 'wf',
        partyA: 'PartyA',
        partyB: 'PartyB',
      }),
    ).rejects.toThrow(/no effects/i)
  })

  test('throws when party has no USD holding', async () => {
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [EFFECT_TEMPLATE_ID]: [effectForUsd('e-1')],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [holdingFor('h-A', 'PartyA::ns', '1000000.0')],
    })
    await expect(
      resolveSettlementInputs(client as LedgerClient, {
        workflowContractId: 'wf',
        partyA: 'PartyA',
        partyB: 'PartyB',
      }),
    ).rejects.toThrow(/USD holding/i)
  })
})

describe('resolveMatureInputs', () => {
  test('happy path with effects returns all fields including holdings', async () => {
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [EFFECT_TEMPLATE_ID]: [effectForUsd('e-1')],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [
        holdingFor('h-A', 'PartyA::ns', '1000000.0'),
        holdingFor('h-B', 'PartyB::ns', '1000000.0'),
      ],
    })
    const result = await resolveMatureInputs(client as LedgerClient, {
      workflowContractId: 'wf-1',
      partyA: 'PartyA',
      partyB: 'PartyB',
    })
    expect(result.effectCids).toEqual(['e-1'])
    expect(result.partyAHoldingCid).toBe('h-A')
    expect(result.partyBHoldingCid).toBe('h-B')
    expect(result.usdInstrumentKey.id.unpack).toBe('USD')
  })

  test('happy path with empty effects returns null holdings', async () => {
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [EFFECT_TEMPLATE_ID]: [],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [],
    })
    const result = await resolveMatureInputs(client as LedgerClient, {
      workflowContractId: 'wf-1',
      partyA: 'PartyA',
      partyB: 'PartyB',
    })
    expect(result.effectCids).toEqual([])
    expect(result.partyAHoldingCid).toBeNull()
    expect(result.partyBHoldingCid).toBeNull()
    expect(result.settlementFactoryCid).toBe('sf-1')
    expect(result.usdInstrumentKey.id.unpack).toBe('USD')
  })

  test('throws when CashSetupRecord missing', async () => {
    const client = fakeClient({})
    await expect(
      resolveMatureInputs(client as LedgerClient, {
        workflowContractId: 'wf',
        partyA: 'PartyA',
        partyB: 'PartyB',
      }),
    ).rejects.toThrow(/cash infrastructure not provisioned/i)
  })

  test('throws when effects present but party has no USD holding', async () => {
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [EFFECT_TEMPLATE_ID]: [effectForUsd('e-1')],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [holdingFor('h-A', 'PartyA::ns', '1000000.0')],
    })
    await expect(
      resolveMatureInputs(client as LedgerClient, {
        workflowContractId: 'wf',
        partyA: 'PartyA',
        partyB: 'PartyB',
      }),
    ).rejects.toThrow(/USD holding/i)
  })
})

describe('resolveTerminateInputs', () => {
  test('happy path returns all fields for both parties', async () => {
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [
        holdingFor('h-A', 'PartyA::ns', '1000000.0'),
        holdingFor('h-B', 'PartyB::ns', '1000000.0'),
      ],
    })
    const result = await resolveTerminateInputs(client as LedgerClient, {
      proposer: 'PartyA::ns',
      counterparty: 'PartyB::ns',
    })
    expect(result.proposerHoldingCid).toBe('h-A')
    expect(result.counterpartyHoldingCid).toBe('h-B')
    expect(result.proposerAccountKey.id.unpack).toBe('acct-A')
    expect(result.counterpartyAccountKey.id.unpack).toBe('acct-B')
    expect(result.settlementFactoryCid).toBe('sf-1')
    expect(result.usdInstrumentKey.id.unpack).toBe('USD')
  })

  test('throws when CashSetupRecord missing', async () => {
    const client = fakeClient({})
    await expect(
      resolveTerminateInputs(client as LedgerClient, {
        proposer: 'PartyA::ns',
        counterparty: 'PartyB::ns',
      }),
    ).rejects.toThrow(/cash infrastructure not provisioned/i)
  })

  test('throws when either party has no USD holding', async () => {
    const client = fakeClient({
      'Setup.CashSetup:CashSetupRecord': [cashRecord],
      [TRANSFERABLE_FUNGIBLE_TEMPLATE_ID]: [holdingFor('h-A', 'PartyA::ns', '1000000.0')],
    })
    await expect(
      resolveTerminateInputs(client as LedgerClient, {
        proposer: 'PartyA::ns',
        counterparty: 'PartyB::ns',
      }),
    ).rejects.toThrow(/USD holding/i)
  })
})
