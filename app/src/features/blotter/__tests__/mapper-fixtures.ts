/**
 * Shared fixtures for blotter mapper tests.
 * Kept in a separate file so each test file stays under 300 lines.
 */

import type {
  FlatInstrumentKeyFields,
  SwapInstrumentPayload,
} from '@/shared/ledger/swap-instrument-types'
import type {
  ContractResult,
  InstrumentKey,
  MaturedSwap,
  TerminatedSwap,
} from '@/shared/ledger/types'

export function instrKey(id: string): InstrumentKey {
  return {
    depository: 'Dep',
    issuer: 'Op',
    id: { unpack: id },
    version: '0',
    holdingStandard: 'TransferableFungible',
  }
}

// V0 swap instrument templates flatten InstrumentKey as top-level fields
// (no `instrument:` wrapper). Spread `flatKey(...)` into payloads so fixtures
// mirror what the JSON API returns from a /v1/query on the template.
export function flatKey(id: string): FlatInstrumentKeyFields {
  return {
    depository: 'Dep',
    issuer: 'Op',
    id: { unpack: id },
    version: '0',
    holdingStandard: 'TransferableFungible',
  }
}

export function periodicSchedule(termDate: string) {
  return {
    effectiveDate: '2026-01-01',
    terminationDate: termDate,
    firstRegularPeriodStartDate: null,
    lastRegularPeriodEndDate: null,
  }
}

export const IRS_INSTR: SwapInstrumentPayload = {
  swapType: 'IRS',
  payload: {
    ...flatKey('IRS-1'),
    description: 'IRS test',
    floatingRate: { referenceRateId: 'SOFR/ON' },
    ownerReceivesFix: false,
    fixRate: '0.04',
    periodicSchedule: periodicSchedule('2026-04-01'),
    dayCountConvention: 'Act360',
    currency: instrKey('USD'),
  },
}

export const CDS_INSTR: SwapInstrumentPayload = {
  swapType: 'CDS',
  payload: {
    ...flatKey('CDS-1'),
    description: 'CDS test',
    defaultProbabilityReferenceId: 'CDS/TSLA/DefaultProb',
    recoveryRateReferenceId: 'CDS/TSLA/Recovery',
    ownerReceivesFix: true,
    fixRate: '0.01',
    periodicSchedule: periodicSchedule('2027-01-01'),
    dayCountConvention: 'Act360',
    currency: instrKey('USD'),
  },
}

export const CCY_INSTR: SwapInstrumentPayload = {
  swapType: 'CCY',
  payload: {
    ...flatKey('CCY-1'),
    description: 'CCY test',
    ownerReceivesBase: true,
    baseRate: '0.03',
    foreignRate: '0.02',
    periodicSchedule: periodicSchedule('2027-01-01'),
    dayCountConvention: 'Act360',
    baseCurrency: instrKey('EUR'),
    foreignCurrency: instrKey('USD'),
    fxRate: '1.08',
  },
}

export const FX_INSTR: SwapInstrumentPayload = {
  swapType: 'FX',
  payload: {
    ...flatKey('FX-1'),
    description: 'FX test',
    firstFxRate: '1.08',
    finalFxRate: '1.09',
    issueDate: '2026-01-01',
    firstPaymentDate: '2026-06-01',
    maturityDate: '2027-01-01',
    baseCurrency: instrKey('USD'),
    foreignCurrency: instrKey('EUR'),
  },
}

export const ASSET_INSTR: SwapInstrumentPayload = {
  swapType: 'ASSET',
  payload: {
    ...flatKey('ASSET-1'),
    description: 'Asset test',
    underlyings: [
      {
        referenceAsset: instrKey('AAPL'),
        referenceAssetId: 'AAPL',
        weight: '1.0',
        initialPrice: '150.0',
      },
    ],
    ownerReceivesRate: true,
    floatingRate: null,
    fixRate: '0.03',
    periodicSchedule: periodicSchedule('2027-01-01'),
    dayCountConvention: 'Act360',
    currency: instrKey('USD'),
  },
}

const FPML_STREAM_FIXTURE = {
  payerPartyReference: 'PartyA',
  receiverPartyReference: 'PartyB',
  calculationPeriodDates: {
    effectiveDate: { unadjustedDate: '2026-01-01' },
    terminationDate: { unadjustedDate: '2028-01-01' },
  },
  calculationPeriodAmount: {
    calculation: {
      notionalScheduleValue: {
        tag: 'NotionalSchedule_Regular' as const,
        value: {
          id: 'notional-1',
          notionalStepSchedule: { initialValue: '10000000', currency: 'USD' },
        },
      },
      rateTypeValue: {
        tag: 'RateType_Fixed' as const,
        value: { initialValue: '0.04' },
      },
      dayCountFraction: 'Act360',
      compoundingMethodEnum: null,
    },
  },
}

export const FPML_INSTR: SwapInstrumentPayload = {
  swapType: 'FpML',
  payload: {
    ...flatKey('FPML-1'),
    description: 'FpML test',
    swapStreams: [FPML_STREAM_FIXTURE],
    issuerPartyRef: 'PartyA',
    currencies: [instrKey('USD'), instrKey('EUR')],
  },
}

// OIS shares the IRS template — same payload shape, different discriminator.
// Pins the fix for "Type column shows OIS but helpers only matched IRS".
// Narrowing IRS_INSTR.payload via the discriminator keeps TS on the
// `{ swapType: 'IRS' | 'OIS'; payload: IrsInstrumentPayload }` branch.
export const OIS_INSTR: SwapInstrumentPayload =
  IRS_INSTR.swapType === 'IRS' ? { swapType: 'OIS', payload: IRS_INSTR.payload } : IRS_INSTR

// BASIS and XCCY share the Fpml template. Separate exports so test names
// read naturally and future shape drift stays scoped.
export const BASIS_INSTR: SwapInstrumentPayload =
  FPML_INSTR.swapType === 'FpML' ? { swapType: 'BASIS', payload: FPML_INSTR.payload } : FPML_INSTR

export const XCCY_INSTR: SwapInstrumentPayload =
  FPML_INSTR.swapType === 'FpML' ? { swapType: 'XCCY', payload: FPML_INSTR.payload } : FPML_INSTR

export function maturedContract(overrides: Partial<MaturedSwap> = {}): ContractResult<MaturedSwap> {
  return {
    contractId: 'cid-matured-1',
    payload: {
      operator: 'Operator',
      partyA: 'PartyA',
      partyB: 'PartyB',
      regulators: ['Regulator'],
      scheduler: 'Scheduler',
      swapType: 'IRS',
      instrumentKey: instrKey('IRS-1'),
      notional: '10000000',
      actualMaturityDate: '2026-04-02',
      finalSettleBatchCid: 'batch-cid-1',
      finalNetAmount: '12345.67',
      ...overrides,
    },
  }
}

export function terminatedContract(
  overrides: Partial<TerminatedSwap> = {},
): ContractResult<TerminatedSwap> {
  return {
    contractId: 'cid-term-1',
    payload: {
      operator: 'Operator',
      partyA: 'PartyA',
      partyB: 'PartyB',
      regulators: ['Regulator'],
      swapType: 'IRS',
      instrumentKey: instrKey('IRS-1'),
      notional: '5000000',
      terminationDate: '2026-04-13',
      agreedPvAmount: '-98765.43',
      reason: 'Counterparty unwind',
      terminatedByParty: 'PartyB',
      settleBatchCid: 'batch-cid-2',
      ...overrides,
    },
  }
}
