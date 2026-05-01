import { describe, expect, test } from 'vitest'
import type { LegConfig } from '../../types'
import { buildProposalPayload } from '../build-proposal-payload'
import { ctx, dates, fixedLeg, floatLeg } from './proposal-fixtures'

describe('buildProposalPayload — OIS', () => {
  test('maps fixedLeg notional + rate and carries explicit maturityDate', () => {
    const result = buildProposalPayload('OIS', [fixedLeg(0.045), floatLeg()], ctx, dates)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.notional).toBe(10_000_000)
      expect(result.payload.fixRate).toBe(0.045)
      expect(result.payload.maturityDate).toBe('2031-04-14')
      expect(result.payload.dayCountConvention).toBe('Act360')
      expect('tenor' in result.payload).toBe(false)
    }
  })
})

describe('buildProposalPayload — IRS tenor bucketing', () => {
  test.each([
    { days: 30, tenor: 'D30' },
    { days: 90, tenor: 'D90' },
    { days: 180, tenor: 'D180' },
    { days: 365, tenor: 'Y1' },
  ])('$days days → tenor $tenor', ({ days, tenor }) => {
    const maturity = new Date(dates.effectiveDate.getTime() + days * 86400000)
    const result = buildProposalPayload(
      'IRS',
      [fixedLeg(), floatLeg()],
      { ...ctx, maturityDate: maturity.toISOString().slice(0, 10) },
      { effectiveDate: dates.effectiveDate, maturityDate: maturity },
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.payload.tenor).toBe(tenor)
  })
})

describe('buildProposalPayload — BASIS', () => {
  test('carries leg0Spread + leg1Spread and shared currency from leg0', () => {
    const leg0: LegConfig = { ...floatLeg('USD', 10_000_000), spread: 0.001 }
    const leg1: LegConfig = { ...floatLeg('USD', 10_000_000), indexId: 'USD-EFFR', spread: 0.0015 }
    const result = buildProposalPayload('BASIS', [leg0, leg1], ctx, dates)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.leg0Spread).toBe(0.001)
      expect(result.payload.leg1Spread).toBe(0.0015)
      expect(result.payload.currency).toBe('USD')
    }
  })
})

describe('buildProposalPayload — XCCY', () => {
  test('accepts valid two-currency legs and maps both to payload', () => {
    const result = buildProposalPayload(
      'XCCY',
      [fixedLeg(0.03, 'USD'), floatLeg('EUR')],
      { ...ctx, allowedCurrencies: ['USD', 'EUR'] },
      dates,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.fixedCurrency).toBe('USD')
      expect(result.payload.floatCurrency).toBe('EUR')
      expect(result.payload.fixedRate).toBe(0.03)
    }
  })

  test('rejects same-currency XCCY (must differ by construction)', () => {
    const result = buildProposalPayload(
      'XCCY',
      [fixedLeg(0.03, 'USD'), floatLeg('USD')],
      ctx,
      dates,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.field).toBe('floatCurrency')
  })

  test('rejects XCCY when either currency is unseeded', () => {
    const bad = buildProposalPayload(
      'XCCY',
      [fixedLeg(0.03, 'USD'), floatLeg('CHF')],
      { ...ctx, allowedCurrencies: ['USD', 'EUR'] },
      dates,
    )
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.field).toBe('floatCurrency')
  })
})

describe('buildProposalPayload — CDS', () => {
  test('notional comes from protection leg; rate from premium leg', () => {
    const premium = fixedLeg(0.012, 'USD', 10_000_000)
    const protection: LegConfig = {
      legType: 'protection',
      direction: 'receive',
      notional: 25_000_000,
      recoveryRate: 0.4,
    }
    const result = buildProposalPayload('CDS', [premium, protection], ctx, dates)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.notional).toBe(25_000_000)
      expect(result.payload.fixRate).toBe(0.012)
      expect(result.payload.ownerReceivesFix).toBe(true)
    }
  })
})

describe('buildProposalPayload — ASSET', () => {
  test('flattens underlyings into parallel id/weight arrays', () => {
    const rate = fixedLeg(0.05, 'USD')
    const asset: LegConfig = {
      legType: 'asset',
      direction: 'receive',
      notional: 10_000_000,
      underlyings: [
        { assetId: 'AAPL', weight: 0.6, initialPrice: 180, currentPrice: 195 },
        { assetId: 'MSFT', weight: 0.4, initialPrice: 400, currentPrice: 420 },
      ],
    }
    const result = buildProposalPayload('ASSET', [rate, asset], ctx, dates)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.underlyingAssetIds).toEqual(['AAPL', 'MSFT'])
      expect(result.payload.underlyingWeights).toEqual([0.6, 0.4])
      expect(result.payload.notional).toBe(10_000_000)
      expect(result.payload.fixRate).toBe(0.05)
    }
  })
})

describe('buildProposalPayload — FpML', () => {
  test('emits a flat legs array, one entry per input leg', () => {
    const result = buildProposalPayload(
      'FpML',
      [fixedLeg(0.04, 'USD'), floatLeg('USD')],
      ctx,
      dates,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      const legs = result.payload.legs as Array<{
        legType: string
        rate: number | null
        indexId: string | null
      }>
      expect(legs).toHaveLength(2)
      expect(legs[0].legType).toBe('fixed')
      expect(legs[0].rate).toBe(0.04)
      expect(legs[1].legType).toBe('float')
      expect(legs[1].indexId).toBe('USD-SOFR')
    }
  })
})

describe('buildProposalPayload — FX additional branches', () => {
  test('payload carries both near (firstFxRate) and far (finalFxRate) legs', () => {
    const fxLegs: LegConfig[] = [
      {
        legType: 'fx',
        direction: 'pay',
        baseCurrency: 'USD',
        foreignCurrency: 'EUR',
        notional: 10_000_000,
        fxRate: 1.08,
        paymentDate: dates.effectiveDate,
      },
      {
        legType: 'fx',
        direction: 'receive',
        baseCurrency: 'USD',
        foreignCurrency: 'EUR',
        notional: 10_000_000,
        fxRate: 1.09,
        paymentDate: dates.maturityDate,
      },
    ]
    const result = buildProposalPayload('FX', fxLegs, ctx, dates)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.firstFxRate).toBe(1.08)
      expect(result.payload.finalFxRate).toBe(1.09)
      expect(result.payload.firstPaymentDate).toBe('2026-04-14')
    }
  })
})

describe('buildProposalPayload — unsupported type', () => {
  test('returns an error result with swapType field pointer', () => {
    const result = buildProposalPayload(
      'BOGUS' as unknown as Parameters<typeof buildProposalPayload>[0],
      [],
      ctx,
      dates,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.field).toBe('swapType')
      expect(result.message).toMatch(/Unsupported/)
    }
  })
})

describe('buildProposalPayload — dayCount mapping', () => {
  test.each([
    { input: 'ACT_360', expected: 'Act360' },
    { input: 'ACT_365', expected: 'Act365Fixed' },
    { input: 'THIRTY_360', expected: 'Basis30360' },
    { input: 'THIRTY_E_360', expected: 'Basis30360' },
  ])('IRS with dayCount $input maps to $expected', ({ input, expected }) => {
    const legs: LegConfig[] = [{ ...fixedLeg(), dayCount: input as never }, floatLeg()]
    const result = buildProposalPayload('IRS', legs, ctx, dates)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.payload.dayCountConvention).toBe(expected)
  })
})
