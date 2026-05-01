import type {
  AssetInstrumentPayload,
  CcyInstrumentPayload,
  CdsInstrumentPayload,
  FpmlInstrumentPayload,
  FxInstrumentPayload,
  IrsInstrumentPayload,
} from '@/shared/ledger/swap-instrument-types'
import type { SwapWorkflow } from '@/shared/ledger/types'

export const PARTY_A = 'PartyA::abc'
export const PARTY_B = 'PartyB::abc'

export const flatKey = {
  depository: 'Operator::dep',
  issuer: 'Operator::iss',
  id: { unpack: 'KEY' },
  version: '0',
  holdingStandard: 'TransferableFungible',
}

export const ccyKey = (code: string) => ({
  depository: 'Operator::dep',
  issuer: 'Operator::iss',
  id: { unpack: code },
  version: '0',
  holdingStandard: 'TransferableFungible',
})

export function workflow(swapType: string, notional: string): SwapWorkflow {
  return {
    swapType,
    operator: 'Operator',
    partyA: PARTY_A,
    partyB: PARTY_B,
    regulators: [],
    scheduler: 'Scheduler',
    instrumentKey: { ...flatKey, id: { unpack: 'KEY' } },
    notional,
  }
}

const baseSchedule = {
  effectiveDate: '2026-04-16',
  terminationDate: '2031-04-16',
  firstRegularPeriodStartDate: null,
  lastRegularPeriodEndDate: null,
}

export function irsInstr(opts?: {
  fixRate?: string
  dayCount?: string
  index?: string
}): IrsInstrumentPayload {
  return {
    ...flatKey,
    description: 'IRS',
    floatingRate: { referenceRateId: opts?.index ?? 'USD-SOFR' },
    ownerReceivesFix: true,
    fixRate: opts?.fixRate ?? '0.0425',
    periodicSchedule: baseSchedule,
    dayCountConvention: opts?.dayCount ?? 'Act360',
    currency: ccyKey('USD'),
  }
}

export function basisInstr(): FpmlInstrumentPayload {
  return {
    ...flatKey,
    description: 'BASIS',
    issuerPartyRef: 'Issuer',
    currencies: [ccyKey('USD')],
    swapStreams: [
      {
        payerPartyReference: 'Issuer',
        receiverPartyReference: 'Counter',
        calculationPeriodDates: {
          effectiveDate: { unadjustedDate: '2026-04-16' },
          terminationDate: { unadjustedDate: '2031-04-16' },
        },
        calculationPeriodAmount: {
          calculation: {
            notionalScheduleValue: {
              tag: 'NotionalSchedule_Regular',
              value: {
                id: 'NSC-1',
                notionalStepSchedule: { initialValue: '25000000.0', currency: 'USD' },
              },
            },
            rateTypeValue: {
              tag: 'RateType_Floating',
              value: {
                floatingRateIndex: 'USD-SOFR',
                spreadSchedule: [{ initialValue: '0.0' }],
              },
            },
            dayCountFraction: 'Act360',
            compoundingMethodEnum: null,
          },
        },
      },
      {
        payerPartyReference: 'Counter',
        receiverPartyReference: 'Issuer',
        calculationPeriodDates: {
          effectiveDate: { unadjustedDate: '2026-04-16' },
          terminationDate: { unadjustedDate: '2031-04-16' },
        },
        calculationPeriodAmount: {
          calculation: {
            notionalScheduleValue: {
              tag: 'NotionalSchedule_Regular',
              value: {
                id: 'NSC-2',
                notionalStepSchedule: { initialValue: '25000000.0', currency: 'USD' },
              },
            },
            rateTypeValue: {
              tag: 'RateType_Floating',
              value: {
                floatingRateIndex: 'USD-EFFR',
                spreadSchedule: [{ initialValue: '0.0025' }],
              },
            },
            dayCountFraction: 'Act360',
            compoundingMethodEnum: null,
          },
        },
      },
    ],
  }
}

export function ccyInstr(): CcyInstrumentPayload {
  return {
    ...flatKey,
    description: 'CCY',
    ownerReceivesBase: true,
    baseRate: '0.04',
    foreignRate: '0.035',
    periodicSchedule: baseSchedule,
    dayCountConvention: 'Act360',
    baseCurrency: ccyKey('USD'),
    foreignCurrency: ccyKey('EUR'),
    fxRate: '0.9',
  }
}

export function fxInstr(): FxInstrumentPayload {
  return {
    ...flatKey,
    description: 'FX',
    firstFxRate: '1.08',
    finalFxRate: '1.085',
    issueDate: '2026-04-16',
    firstPaymentDate: '2026-07-16',
    maturityDate: '2027-04-16',
    baseCurrency: ccyKey('USD'),
    foreignCurrency: ccyKey('EUR'),
  }
}

export function cdsInstr(): CdsInstrumentPayload {
  return {
    ...flatKey,
    description: 'CDS',
    defaultProbabilityReferenceId: 'CDS/X/DefaultProb',
    recoveryRateReferenceId: 'CDS/X/Recovery',
    ownerReceivesFix: false,
    fixRate: '0.01',
    periodicSchedule: baseSchedule,
    dayCountConvention: 'Act360',
    currency: ccyKey('USD'),
  }
}

export function assetInstr(): AssetInstrumentPayload {
  return {
    ...flatKey,
    description: 'ASSET',
    ownerReceivesRate: true,
    floatingRate: { referenceRateId: 'USD-SOFR' },
    fixRate: '0.0',
    periodicSchedule: baseSchedule,
    dayCountConvention: 'Act360',
    currency: ccyKey('USD'),
    underlyings: [
      {
        referenceAsset: ccyKey('UST'),
        referenceAssetId: 'UST-10Y',
        weight: '1.0',
        initialPrice: '100.0',
      },
    ],
  }
}
