/**
 * Tests for the pure helper functions in proposal-helpers.ts.
 */
import { describe, expect, test } from 'vitest'
import type {
  AssetSwapProposal,
  CcySwapProposal,
  CdsProposal,
  FpmlProposal,
  FxSwapProposal,
  SwapProposal,
} from '@/shared/ledger/types'
import {
  getCounterparty,
  getCurrency,
  getDirection,
  getMaturity,
  getNotional,
} from './proposal-helpers'

const BASE_IRS: SwapProposal = {
  proposer: 'PartyA::1220abc',
  counterparty: 'PartyB::1220abc',
  operator: 'Operator::1220abc',
  notional: '10000000',
  fixRate: '0.035',
  tenor: '5Y',
  startDate: '2026-01-15',
  dayCountConvention: 'ACT_360',
}

const BASE_CDS: CdsProposal = {
  proposer: 'PartyA::1220abc',
  counterparty: 'PartyB::1220abc',
  operator: 'Operator::1220abc',
  notional: '5000000',
  fixRate: '0.01',
  ownerReceivesFix: true,
  referenceName: 'TSLA',
  startDate: '2026-01-15',
  maturityDate: '2031-01-15',
  dayCountConvention: 'ACT_360',
}

const BASE_CCY: CcySwapProposal = {
  proposer: 'PartyA::1220abc',
  counterparty: 'PartyB::1220abc',
  operator: 'Operator::1220abc',
  notional: '20000000',
  baseRate: '0.04',
  foreignRate: '0.02',
  baseCurrency: 'USD',
  foreignCurrency: 'EUR',
  fxRate: '1.08',
  ownerReceivesBase: true,
  startDate: '2026-01-15',
  maturityDate: '2031-01-15',
  dayCountConvention: 'ACT_360',
}

const BASE_FPML: FpmlProposal = {
  proposer: 'PartyA::1220abc',
  counterparty: 'PartyB::1220abc',
  operator: 'Operator::1220abc',
  legs: [
    {
      legType: 'fixed',
      currency: 'GBP',
      notional: '15000000',
      rate: '0.04',
      indexId: null,
      spread: null,
      dayCountConvention: 'ACT_365',
    },
  ],
  startDate: '2026-01-15',
  maturityDate: '2031-01-15',
  description: 'Test FpML',
}

describe('getNotional', () => {
  test('extracts from root for IRS', () => {
    expect(getNotional('IRS', BASE_IRS)).toBe(10_000_000)
  })
  test('extracts from legs[0] for FpML', () => {
    expect(getNotional('FpML', BASE_FPML)).toBe(15_000_000)
  })
  test('returns 0 for FpML with empty legs', () => {
    expect(getNotional('FpML', { ...BASE_FPML, legs: [] })).toBe(0)
  })
})

describe('getCounterparty', () => {
  test('returns counterparty when active is proposer', () => {
    expect(getCounterparty(BASE_IRS, 'PartyA')).toBe('PartyB::1220abc')
  })
  test('returns proposer when active is counterparty', () => {
    expect(getCounterparty(BASE_IRS, 'PartyB')).toBe('PartyA::1220abc')
  })
})

describe('getDirection', () => {
  test('IRS proposer pays', () => {
    expect(getDirection('IRS', BASE_IRS, 'PartyA')).toBe('pay')
  })
  test('IRS counterparty receives', () => {
    expect(getDirection('IRS', BASE_IRS, 'PartyB')).toBe('receive')
  })
  test('CDS ownerReceivesFix=true, proposer receives', () => {
    expect(getDirection('CDS', BASE_CDS, 'PartyA')).toBe('receive')
  })
  test('CDS ownerReceivesFix=true, counterparty pays', () => {
    expect(getDirection('CDS', BASE_CDS, 'PartyB')).toBe('pay')
  })
  test('CCY ownerReceivesBase=true, proposer receives', () => {
    expect(getDirection('CCY', BASE_CCY, 'PartyA')).toBe('receive')
  })
  test('ASSET ownerReceivesRate direction', () => {
    const asset: AssetSwapProposal = {
      proposer: 'PartyA::1220abc',
      counterparty: 'PartyB::1220abc',
      operator: 'Operator::1220abc',
      notional: '10000000',
      fixRate: '0.03',
      ownerReceivesRate: false,
      underlyingAssetIds: [],
      underlyingWeights: [],
      startDate: '2026-01-15',
      maturityDate: '2031-01-15',
      dayCountConvention: 'ACT_360',
    }
    expect(getDirection('ASSET', asset, 'PartyA')).toBe('pay')
  })
})

describe('getCurrency', () => {
  test('IRS defaults to USD', () => {
    expect(getCurrency('IRS', BASE_IRS)).toBe('USD')
  })
  test('CCY returns baseCurrency', () => {
    expect(getCurrency('CCY', BASE_CCY)).toBe('USD')
  })
  test('FpML returns legs[0].currency', () => {
    expect(getCurrency('FpML', BASE_FPML)).toBe('GBP')
  })
  test('FX returns baseCurrency', () => {
    const fx: FxSwapProposal = {
      proposer: 'PartyA::1220abc',
      counterparty: 'PartyB::1220abc',
      operator: 'Operator::1220abc',
      notional: '10000000',
      baseCurrency: 'JPY',
      foreignCurrency: 'USD',
      firstFxRate: '150.5',
      finalFxRate: '149.0',
      firstPaymentDate: '2026-03-15',
      maturityDate: '2026-09-15',
    }
    expect(getCurrency('FX', fx)).toBe('JPY')
  })
})

describe('getMaturity', () => {
  // IRS proposals store `tenor` (D30/D90/D180/Y1) and `startDate` instead of
  // an explicit maturityDate — the blotter must derive maturity from those
  // so it doesn't render "—" forever. Tenor-to-days mapping mirrors the
  // Daml `tenorToDays` in Swap/Types.daml:
  //   D30 → 30, D90 → 91, D180 → 182, Y1 → 365.
  test('IRS derives maturity from startDate + D30 tenor', () => {
    expect(getMaturity('IRS', { ...BASE_IRS, tenor: 'D30', startDate: '2026-01-15' })).toBe(
      '2026-02-14',
    )
  })
  test('IRS derives maturity from startDate + D90 tenor', () => {
    expect(getMaturity('IRS', { ...BASE_IRS, tenor: 'D90', startDate: '2026-01-15' })).toBe(
      '2026-04-16',
    )
  })
  test('IRS derives maturity from startDate + D180 tenor', () => {
    expect(getMaturity('IRS', { ...BASE_IRS, tenor: 'D180', startDate: '2026-01-15' })).toBe(
      '2026-07-16',
    )
  })
  test('IRS derives maturity from startDate + Y1 tenor', () => {
    expect(getMaturity('IRS', { ...BASE_IRS, tenor: 'Y1', startDate: '2026-01-15' })).toBe(
      '2027-01-15',
    )
  })
  test('IRS with unknown tenor falls back to dash', () => {
    expect(getMaturity('IRS', { ...BASE_IRS, tenor: 'UNKNOWN', startDate: '2026-01-15' })).toBe('—')
  })
  test('CDS returns maturityDate', () => {
    expect(getMaturity('CDS', BASE_CDS)).toBe('2031-01-15')
  })
  test('FpML returns maturityDate', () => {
    expect(getMaturity('FpML', BASE_FPML)).toBe('2031-01-15')
  })
})
