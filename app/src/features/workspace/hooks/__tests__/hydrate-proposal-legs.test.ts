import type {
  AssetLegConfig,
  FixedLegConfig,
  FloatLegConfig,
  FxLegConfig,
  ProtectionLegConfig,
} from '@irsforge/shared-pricing'
import { describe, expect, test } from 'vitest'
import { hydrateProposalPayload } from '../hydrate-proposal-legs'

// Parties arrive from /v1/query as "Hint::<fingerprint>"; the hydrator must
// strip the fingerprint for the UI counterparty field. Decimal fields arrive
// as JSON strings (Canton convention) — pricing needs numbers.

const PARTY_A = 'PartyA::12200fb578df688581ab2b5b09522b64ab1c29d8d23cdb2945c4ee5da199d2d67ad2'
const PARTY_B = 'PartyB::12200fb578df688581ab2b5b09522b64ab1c29d8d23cdb2945c4ee5da199d2d67ad2'

describe('hydrateProposalPayload — IRS', () => {
  test('maps notional/rate/tenor/day-count and derives counterparty hint', () => {
    const result = hydrateProposalPayload(
      'IRS',
      {
        operator: 'Operator',
        proposer: PARTY_A,
        counterparty: PARTY_B,
        notional: '10000000.0',
        fixRate: '0.0485',
        tenor: 'D90',
        startDate: '2026-04-16',
        dayCountConvention: 'Act360',
      },
      'PartyB',
    )
    expect(result.swapType).toBe('IRS')
    expect(result.counterpartyHint).toBe('PartyA')
    const fixed = result.legs[0] as FixedLegConfig
    const float = result.legs[1] as FloatLegConfig
    expect(fixed.notional).toBe(10_000_000)
    expect(fixed.rate).toBe(0.0485)
    expect(fixed.dayCount).toBe('ACT_360')
    // Post-Phase-3: the IRS proposal no longer carries `floatingRateId` —
    // the hydrator shows a USD-SOFR placeholder (the FloatingRateIndex
    // registry key); the authoritative index is chosen by the accepter
    // at accept-time.
    expect(float.indexId).toBe('USD-SOFR')
    expect(result.dates.effectiveDate.getFullYear()).toBe(2026)
    expect(result.dates.maturityDate.getTime()).toBeGreaterThan(
      result.dates.effectiveDate.getTime(),
    )
  })

  test('when active party is the proposer, counterpartyHint is the ledger counterparty', () => {
    const result = hydrateProposalPayload(
      'IRS',
      {
        operator: 'Operator',
        proposer: PARTY_A,
        counterparty: PARTY_B,
        notional: '1000',
        fixRate: '0.04',
        tenor: 'Y1',
        startDate: '2026-01-15',
        dayCountConvention: 'Act360',
      },
      'PartyA',
    )
    expect(result.counterpartyHint).toBe('PartyB')
  })
})

describe('hydrateProposalPayload — CDS / CCY / FX / ASSET / FpML', () => {
  test('CDS: protection leg carries notional, premium leg carries fixRate', () => {
    const r = hydrateProposalPayload(
      'CDS',
      {
        operator: 'O',
        proposer: PARTY_A,
        counterparty: PARTY_B,
        notional: '5000000.0',
        fixRate: '0.015',
        referenceName: 'TSLA',
        ownerReceivesFix: true,
        startDate: '2026-04-16',
        maturityDate: '2031-04-16',
        dayCountConvention: 'Act360',
      },
      'PartyB',
    )
    expect(r.swapType).toBe('CDS')
    const fixed = r.legs[0] as FixedLegConfig
    const protection = r.legs[1] as ProtectionLegConfig
    expect(fixed.rate).toBe(0.015)
    expect(protection.notional).toBe(5_000_000)
  })

  test('CCY: base/foreign currencies and rates propagate', () => {
    const r = hydrateProposalPayload(
      'CCY',
      {
        operator: 'O',
        proposer: PARTY_A,
        counterparty: PARTY_B,
        notional: '50000000.0',
        baseRate: '0.04',
        foreignRate: '0.035',
        baseCurrency: 'USD',
        foreignCurrency: 'EUR',
        fxRate: '1.08',
        ownerReceivesBase: true,
        startDate: '2026-04-16',
        maturityDate: '2031-04-16',
        dayCountConvention: 'Act360',
      },
      'PartyB',
    )
    const base = r.legs[0] as FixedLegConfig
    const foreign = r.legs[1] as FixedLegConfig
    expect(base.currency).toBe('USD')
    expect(foreign.currency).toBe('EUR')
    expect(base.rate).toBe(0.04)
    expect(foreign.rate).toBe(0.035)
  })

  test('FX: near/far legs carry distinct fxRates', () => {
    const r = hydrateProposalPayload(
      'FX',
      {
        operator: 'O',
        proposer: PARTY_A,
        counterparty: PARTY_B,
        notional: '10000000.0',
        baseCurrency: 'USD',
        foreignCurrency: 'EUR',
        firstFxRate: '1.08',
        finalFxRate: '1.085',
        firstPaymentDate: '2026-04-16',
        maturityDate: '2027-04-16',
      },
      'PartyB',
    )
    const near = r.legs[0] as FxLegConfig
    const far = r.legs[1] as FxLegConfig
    expect(near.fxRate).toBeCloseTo(1.08)
    expect(far.fxRate).toBeCloseTo(1.085)
  })

  test('ASSET: underlyings rebuilt from parallel arrays', () => {
    // Post-Phase-3: the ASSET proposal no longer carries `floatingRateId` —
    // the counterparty picks a FloatingRateIndex at accept-time. The
    // hydrator renders the rate leg as a plain fixed-rate preview.
    const r = hydrateProposalPayload(
      'ASSET',
      {
        operator: 'O',
        proposer: PARTY_A,
        counterparty: PARTY_B,
        notional: '10000000.0',
        fixRate: '0.05',
        ownerReceivesRate: true,
        underlyingAssetIds: ['UST-10Y', 'AAPL'],
        underlyingWeights: ['0.6', '0.4'],
        startDate: '2026-04-16',
        maturityDate: '2027-04-16',
        dayCountConvention: 'Act365Fixed',
      },
      'PartyB',
    )
    const asset = r.legs[0] as AssetLegConfig
    expect(asset.underlyings.map((u) => u.assetId)).toEqual(['UST-10Y', 'AAPL'])
    expect(asset.underlyings.map((u) => u.weight)).toEqual([0.6, 0.4])
    expect((r.legs[1] as FixedLegConfig).dayCount).toBe('ACT_365')
  })

  test('FpML: multi-leg payload preserved, float spreads coerced to number', () => {
    const r = hydrateProposalPayload(
      'FpML',
      {
        operator: 'O',
        proposer: PARTY_A,
        counterparty: PARTY_B,
        startDate: '2026-04-16',
        maturityDate: '2027-04-16',
        description: 'test',
        legs: [
          {
            legType: 'fixed',
            currency: 'USD',
            notional: '5000000',
            rate: '0.04',
            indexId: null,
            spread: null,
            dayCountConvention: 'Act360',
          },
          {
            legType: 'float',
            currency: 'USD',
            notional: '5000000',
            rate: null,
            indexId: 'SOFR/3M',
            spread: '0.0025',
            dayCountConvention: 'Act360',
          },
        ],
      },
      'PartyB',
    )
    expect(r.swapType).toBe('FpML')
    expect(r.legs).toHaveLength(2)
    expect((r.legs[0] as FixedLegConfig).rate).toBe(0.04)
    expect((r.legs[1] as FloatLegConfig).spread).toBe(0.0025)
  })
})

describe('hydrateProposalPayload — defensive parsing', () => {
  test('unparseable decimal falls back to 0 rather than NaN', () => {
    const r = hydrateProposalPayload(
      'IRS',
      {
        operator: 'O',
        proposer: PARTY_A,
        counterparty: PARTY_B,
        notional: 'not-a-number',
        fixRate: '',
        tenor: 'Y1',
        startDate: '2026-01-01',
        dayCountConvention: 'Act360',
      },
      'PartyB',
    )
    const fixed = r.legs[0] as FixedLegConfig
    expect(fixed.notional).toBe(0)
    expect(fixed.rate).toBe(0)
  })
})
