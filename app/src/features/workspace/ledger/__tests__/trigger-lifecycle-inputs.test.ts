import { describe, expect, test, vi } from 'vitest'

import type { LedgerClient } from '@/shared/ledger/client'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import { OBSERVATION_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { InstrumentKey } from '@/shared/ledger/types'
import type { ObservablesConfig } from '../../types'
import { resolveTriggerLifecycleInputs, TriggerLifecycleError } from '../trigger-lifecycle-inputs'

vi.mock('@/shared/ledger/generated/package-ids', () => ({
  IRSFORGE_PACKAGE_ID: 'test-irsforge-pkg',
  DAML_FINANCE_DATA_PACKAGE_ID: 'test-daml-finance-data-pkg',
  DAML_FINANCE_LIFECYCLE_PACKAGE_ID: 'test-daml-finance-lifecycle-pkg',
  DAML_FINANCE_HOLDING_PACKAGE_ID: 'test-daml-finance-holding-pkg',
  DAML_FINANCE_CLAIMS_PACKAGE_ID: 'test-daml-finance-claims-pkg',
  DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID: 'test-daml-finance-instrument-swap-pkg',
}))

const OBS: ObservablesConfig = {
  IRS: { rateIds: ['SOFR/ON'], kind: 'periodic-fixing', enabled: true },
  OIS: { rateIds: ['SOFR/ON'], kind: 'periodic-fixing', enabled: true },
  BASIS: { rateIds: ['SOFR/ON'], kind: 'periodic-fixing', enabled: false },
  XCCY: { rateIds: ['SOFR/ON'], kind: 'periodic-fixing', enabled: false },
  CDS: {
    rateIdPattern: 'CDS/{refName}/{DefaultProb|Recovery}',
    kind: 'credit-event',
    enabled: true,
  },
  CCY: { rateIds: [], kind: 'none', enabled: true },
  FX: { rateIds: [], kind: 'none', enabled: true },
  ASSET: { rateIdPattern: 'ASSET/{assetId}', kind: 'price', enabled: false },
  FpML: { rateIds: [], kind: 'embedded', enabled: true },
}

const cashRecord = {
  contractId: 'cash-1',
  payload: { lifecycleRuleCid: 'lr-1', eventFactoryCid: 'ef-1' },
}

function instrKey(id: string): InstrumentKey {
  return {
    depository: 'Dep',
    issuer: 'Op',
    id: { unpack: id },
    version: '0',
    holdingStandard: 'TransferableFungible',
  }
}

// V0 swap instrument templates flatten InstrumentKey into top-level fields.
function flatKey(id: string) {
  return {
    depository: 'Dep',
    issuer: 'Op',
    id: { unpack: id },
    version: '0',
    holdingStandard: 'TransferableFungible',
  }
}

function schedule() {
  return {
    effectiveDate: '2026-01-01',
    terminationDate: '2027-01-01',
    firstRegularPeriodStartDate: null,
    lastRegularPeriodEndDate: null,
  }
}

const obsRecord = (rateId: string, cid: string) => ({
  contractId: cid,
  payload: { provider: 'Operator::ns', id: { unpack: rateId }, observations: {}, observers: {} },
})

function fakeClient(opts: {
  queries?: Record<string, unknown[]>
  exerciseResult?: unknown
}): Pick<LedgerClient, 'query' | 'exercise'> {
  return {
    query: vi.fn((tpl: string) =>
      Promise.resolve(opts.queries?.[tpl] ?? []),
    ) as LedgerClient['query'],
    exercise: vi.fn(() =>
      Promise.resolve(opts.exerciseResult ?? { result: { exerciseResult: 'event-1' } }),
    ),
  }
}

const irsInstr: SwapInstrumentPayload = {
  swapType: 'IRS',
  payload: {
    ...flatKey('IRS-1'),
    description: '',
    floatingRate: { referenceRateId: 'SOFR/ON' },
    ownerReceivesFix: false,
    fixRate: '0.04',
    periodicSchedule: schedule(),
    dayCountConvention: 'Act360',
    currency: instrKey('USD'),
  },
}

const cdsInstr: SwapInstrumentPayload = {
  swapType: 'CDS',
  payload: {
    ...flatKey('CDS-1'),
    description: '',
    defaultProbabilityReferenceId: 'CDS/TSLA/DefaultProb',
    recoveryRateReferenceId: 'CDS/TSLA/Recovery',
    ownerReceivesFix: true,
    fixRate: '0.01',
    periodicSchedule: schedule(),
    dayCountConvention: 'Act360',
    currency: instrKey('USD'),
  },
}

const ccyInstr: SwapInstrumentPayload = {
  swapType: 'CCY',
  payload: {
    ...flatKey('CCY-1'),
    description: '',
    ownerReceivesBase: true,
    baseRate: '0.04',
    foreignRate: '0.02',
    periodicSchedule: schedule(),
    dayCountConvention: 'Act360',
    baseCurrency: instrKey('USD'),
    foreignCurrency: instrKey('EUR'),
    fxRate: '1.08',
  },
}

const fxInstr: SwapInstrumentPayload = {
  swapType: 'FX',
  payload: {
    ...flatKey('FX-1'),
    description: '',
    firstFxRate: '1.08',
    finalFxRate: '1.09',
    issueDate: '2026-01-01',
    firstPaymentDate: '2026-06-14',
    maturityDate: '2027-01-01',
    baseCurrency: instrKey('USD'),
    foreignCurrency: instrKey('EUR'),
  },
}

const assetInstr: SwapInstrumentPayload = {
  swapType: 'ASSET',
  payload: {
    ...flatKey('ASSET-1'),
    description: '',
    underlyings: [
      {
        referenceAsset: instrKey('AAPL'),
        referenceAssetId: 'AAPL',
        weight: '1.0',
        initialPrice: '150',
      },
    ],
    ownerReceivesRate: true,
    floatingRate: null,
    fixRate: '0.03',
    periodicSchedule: schedule(),
    dayCountConvention: 'Act360',
    currency: instrKey('USD'),
  },
}

describe('resolveTriggerLifecycleInputs', () => {
  test('IRS: returns the SOFR/ON observation cid', async () => {
    const client = fakeClient({
      queries: {
        'Setup.CashSetup:CashSetupRecord': [cashRecord],
        [OBSERVATION_TEMPLATE_ID]: [
          obsRecord('SOFR/ON', 'obs-sofr'),
          obsRecord('OTHER', 'obs-other'),
        ],
      },
    })
    const result = await resolveTriggerLifecycleInputs(client as LedgerClient, {
      swapType: 'IRS',
      instrument: irsInstr,
      observablesConfig: OBS,
      eventDate: '2026-04-14',
    })
    expect(result.lifecycleRuleCid).toBe('lr-1')
    expect(result.eventCid).toBe('event-1')
    expect(result.observableCids).toEqual(['obs-sofr'])
  })

  test('CDS: returns both DefaultProb + Recovery observation cids', async () => {
    const client = fakeClient({
      queries: {
        'Setup.CashSetup:CashSetupRecord': [cashRecord],
        [OBSERVATION_TEMPLATE_ID]: [
          obsRecord('CDS/TSLA/DefaultProb', 'obs-dp'),
          obsRecord('CDS/TSLA/Recovery', 'obs-rr'),
        ],
      },
    })
    const result = await resolveTriggerLifecycleInputs(client as LedgerClient, {
      swapType: 'CDS',
      instrument: cdsInstr,
      observablesConfig: OBS,
      eventDate: '2026-04-14',
    })
    expect(result.observableCids).toEqual(['obs-dp', 'obs-rr'])
  })

  test('CCY: returns empty observableCids (no observation query needed)', async () => {
    const client = fakeClient({
      queries: { 'Setup.CashSetup:CashSetupRecord': [cashRecord] },
    })
    const result = await resolveTriggerLifecycleInputs(client as LedgerClient, {
      swapType: 'CCY',
      instrument: ccyInstr,
      observablesConfig: OBS,
      eventDate: '2026-04-14',
    })
    expect(result.observableCids).toEqual([])
    expect(client.query).not.toHaveBeenCalledWith(OBSERVATION_TEMPLATE_ID)
  })

  test('FX: returns empty observableCids', async () => {
    const client = fakeClient({
      queries: { 'Setup.CashSetup:CashSetupRecord': [cashRecord] },
    })
    const result = await resolveTriggerLifecycleInputs(client as LedgerClient, {
      swapType: 'FX',
      instrument: fxInstr,
      observablesConfig: OBS,
      eventDate: '2026-04-14',
    })
    expect(result.observableCids).toEqual([])
  })

  test('ASSET disabled: empty observableCids, no observation query', async () => {
    const client = fakeClient({
      queries: { 'Setup.CashSetup:CashSetupRecord': [cashRecord] },
    })
    const result = await resolveTriggerLifecycleInputs(client as LedgerClient, {
      swapType: 'ASSET',
      instrument: assetInstr,
      observablesConfig: OBS,
      eventDate: '2026-04-14',
    })
    expect(result.observableCids).toEqual([])
    expect(client.query).not.toHaveBeenCalledWith(OBSERVATION_TEMPLATE_ID)
  })

  test('ASSET enabled but missing feeds: throws TriggerLifecycleError', async () => {
    const enabledObs: ObservablesConfig = { ...OBS, ASSET: { ...OBS.ASSET, enabled: true } }
    const client = fakeClient({
      queries: {
        'Setup.CashSetup:CashSetupRecord': [cashRecord],
        [OBSERVATION_TEMPLATE_ID]: [],
      },
    })
    await expect(
      resolveTriggerLifecycleInputs(client as LedgerClient, {
        swapType: 'ASSET',
        instrument: assetInstr,
        observablesConfig: enabledObs,
        eventDate: '2026-04-14',
      }),
    ).rejects.toBeInstanceOf(TriggerLifecycleError)
  })

  test('throws TriggerLifecycleError when cash record missing', async () => {
    const client = fakeClient({ queries: {} })
    await expect(
      resolveTriggerLifecycleInputs(client as LedgerClient, {
        swapType: 'IRS',
        instrument: irsInstr,
        observablesConfig: OBS,
        eventDate: '2026-04-14',
      }),
    ).rejects.toBeInstanceOf(TriggerLifecycleError)
  })
})
