import { describe, expect, it } from 'vitest'
import {
  getInstrumentLegDetail,
  getInstrumentTradeDate,
  isMaturingWithin,
} from '../instrument-helpers'
import type {
  AssetInstrumentPayload,
  CcyInstrumentPayload,
  CdsInstrumentPayload,
  FxInstrumentPayload,
  InstrumentKey,
  IrsInstrumentPayload,
  SwapInstrumentPayload,
} from '../swap-instrument-types'

function key(id: string): InstrumentKey {
  return {
    depository: 'Dep',
    issuer: 'Op',
    id: { unpack: id },
    version: '0',
    holdingStandard: 'TransferableFungible',
  }
}

const flat = (id: string) => ({ ...key(id) })

const periodicSchedule = (effective: string, termination: string) => ({
  effectiveDate: effective,
  terminationDate: termination,
  firstRegularPeriodStartDate: null,
  lastRegularPeriodEndDate: null,
})

const irs: SwapInstrumentPayload = {
  swapType: 'IRS',
  payload: {
    ...flat('IRS-1'),
    description: '',
    floatingRate: { referenceRateId: 'SOFR' },
    ownerReceivesFix: false,
    fixRate: '0.0425',
    periodicSchedule: periodicSchedule('2026-01-01', '2031-01-01'),
    dayCountConvention: 'Act360',
    currency: key('USD'),
  } satisfies IrsInstrumentPayload,
}

const cds: SwapInstrumentPayload = {
  swapType: 'CDS',
  payload: {
    ...flat('CDS-1'),
    description: '',
    defaultProbabilityReferenceId: 'AAPL',
    recoveryRateReferenceId: 'AAPL',
    ownerReceivesFix: true,
    fixRate: '0.01',
    periodicSchedule: periodicSchedule('2026-01-01', '2031-01-01'),
    dayCountConvention: 'Act360',
    currency: key('USD'),
  } satisfies CdsInstrumentPayload,
}

const ccy: SwapInstrumentPayload = {
  swapType: 'CCY',
  payload: {
    ...flat('CCY-1'),
    description: '',
    ownerReceivesBase: true,
    baseRate: '0.04',
    foreignRate: '0.025',
    periodicSchedule: periodicSchedule('2026-01-01', '2031-01-01'),
    dayCountConvention: 'Act360',
    baseCurrency: key('USD'),
    foreignCurrency: key('EUR'),
    fxRate: '1.10',
  } satisfies CcyInstrumentPayload,
}

const fx: SwapInstrumentPayload = {
  swapType: 'FX',
  payload: {
    ...flat('FX-1'),
    description: '',
    firstFxRate: '1.10',
    finalFxRate: '1.12',
    issueDate: '2026-01-01',
    firstPaymentDate: '2026-01-03',
    maturityDate: '2026-04-01',
    baseCurrency: key('USD'),
    foreignCurrency: key('EUR'),
  } satisfies FxInstrumentPayload,
}

const assetSwap: SwapInstrumentPayload = {
  swapType: 'ASSET',
  payload: {
    ...flat('ASSET-1'),
    description: '',
    underlyings: [],
    ownerReceivesRate: false,
    floatingRate: { referenceRateId: 'SOFR' },
    fixRate: '0.05',
    periodicSchedule: periodicSchedule('2026-01-01', '2031-01-01'),
    dayCountConvention: 'Act360',
    currency: key('USD'),
  } satisfies AssetInstrumentPayload,
}

describe('getInstrumentTradeDate', () => {
  it('reads effectiveDate for IRS', () => {
    expect(getInstrumentTradeDate(irs)).toBe('2026-01-01')
  })
  it('reads issueDate for FX', () => {
    expect(getInstrumentTradeDate(fx)).toBe('2026-01-01')
  })
  it('returns the loading placeholder when instrument is undefined', () => {
    expect(getInstrumentTradeDate(undefined)).toBe('—')
  })
})

describe('getInstrumentLegDetail', () => {
  it('renders Fixed pct / float index for IRS', () => {
    expect(getInstrumentLegDetail(irs)).toBe('Fixed 4.25% / SOFR')
  })
  it('renders Fixed pct / Protection for CDS', () => {
    expect(getInstrumentLegDetail(cds)).toBe('Fixed 1% / Protection')
  })
  it('renders both fixed rates for CCY', () => {
    expect(getInstrumentLegDetail(ccy)).toBe('Fixed 4% / Fixed 2.5%')
  })
  it('renders Fixed pct / float index for ASSET when a float leg is present', () => {
    expect(getInstrumentLegDetail(assetSwap)).toBe('Fixed 5% / SOFR')
  })
  it('returns empty for FX (no rate legs)', () => {
    expect(getInstrumentLegDetail(fx)).toBe('')
  })
  it('returns empty when the instrument is still loading', () => {
    expect(getInstrumentLegDetail(undefined)).toBe('')
  })
})

describe('isMaturingWithin', () => {
  it('returns true when maturity is within the window', () => {
    const now = new Date('2026-04-01')
    const soon: SwapInstrumentPayload = {
      ...irs,
      payload: { ...irs.payload, periodicSchedule: periodicSchedule('2026-01-01', '2026-04-05') },
    } as SwapInstrumentPayload
    expect(isMaturingWithin(soon, 7, now)).toBe(true)
  })
  it('returns false when maturity is past the window', () => {
    const now = new Date('2026-04-01')
    expect(isMaturingWithin(irs, 7, now)).toBe(false)
  })
  it('returns false when the swap has already matured', () => {
    const now = new Date('2032-01-01')
    expect(isMaturingWithin(irs, 7, now)).toBe(false)
  })
  it('returns false when the instrument is still loading', () => {
    expect(isMaturingWithin(undefined)).toBe(false)
  })
})
