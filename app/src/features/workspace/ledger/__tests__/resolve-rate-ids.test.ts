import { describe, expect, test } from 'vitest'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import type { InstrumentKey } from '@/shared/ledger/types'
import type { ObservablesConfig } from '../../types'
import { resolveRateIdsForSwap } from '../resolve-rate-ids'

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
    baseRate: '0.03',
    foreignRate: '0.02',
    periodicSchedule: schedule(),
    dayCountConvention: 'Act360',
    baseCurrency: instrKey('EUR'),
    foreignCurrency: instrKey('USD'),
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
        weight: '0.5',
        initialPrice: '150',
      },
      {
        referenceAsset: instrKey('MSFT'),
        referenceAssetId: 'MSFT',
        weight: '0.5',
        initialPrice: '300',
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

const fpmlInstr: SwapInstrumentPayload = {
  swapType: 'FpML',
  payload: {
    ...flatKey('FPML-1'),
    description: '',
    swapStreams: [
      {
        payerPartyReference: 'PartyA',
        receiverPartyReference: 'PartyB',
        calculationPeriodDates: {
          effectiveDate: { unadjustedDate: '2026-01-01' },
          terminationDate: { unadjustedDate: '2031-01-01' },
        },
        calculationPeriodAmount: {
          calculation: {
            notionalScheduleValue: {
              tag: 'NotionalSchedule_Regular',
              value: { id: 'N', notionalStepSchedule: { initialValue: '1', currency: 'USD' } },
            },
            rateTypeValue: { tag: 'RateType_Fixed', value: { initialValue: '0.04' } },
            dayCountFraction: 'Act360',
            compoundingMethodEnum: null,
          },
        },
      },
    ],
    issuerPartyRef: 'PartyA',
    currencies: [instrKey('USD')],
  },
}

describe('resolveRateIdsForSwap', () => {
  test('IRS returns the floating rate id from the instrument', () => {
    expect(resolveRateIdsForSwap('IRS', irsInstr, OBS)).toEqual(['SOFR/ON'])
  })

  test('IRS falls back to config rateIds when instrument is null', () => {
    expect(resolveRateIdsForSwap('IRS', null, OBS)).toEqual(['SOFR/ON'])
  })

  test('CDS returns defaultProbabilityReferenceId + recoveryRateReferenceId verbatim', () => {
    expect(resolveRateIdsForSwap('CDS', cdsInstr, OBS)).toEqual([
      'CDS/TSLA/DefaultProb',
      'CDS/TSLA/Recovery',
    ])
  })

  test('CCY returns empty', () => {
    expect(resolveRateIdsForSwap('CCY', ccyInstr, OBS)).toEqual([])
  })

  test('FX returns empty', () => {
    expect(resolveRateIdsForSwap('FX', fxInstr, OBS)).toEqual([])
  })

  test('FpML returns empty', () => {
    expect(resolveRateIdsForSwap('FpML', fpmlInstr, OBS)).toEqual([])
  })

  test('ASSET disabled returns empty', () => {
    expect(resolveRateIdsForSwap('ASSET', assetInstr, OBS)).toEqual([])
  })

  test('ASSET enabled returns per-asset ids via pattern', () => {
    const enabledObs: ObservablesConfig = {
      ...OBS,
      ASSET: { ...OBS.ASSET, enabled: true },
    }
    expect(resolveRateIdsForSwap('ASSET', assetInstr, enabledObs)).toEqual([
      'ASSET/AAPL',
      'ASSET/MSFT',
    ])
  })
})
