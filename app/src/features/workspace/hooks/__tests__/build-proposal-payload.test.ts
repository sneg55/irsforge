import { describe, expect, test } from 'vitest'
import type { LegConfig } from '../../types'
import { buildProposalPayload } from '../build-proposal-payload'

const dates = {
  effectiveDate: new Date('2026-04-14'),
  maturityDate: new Date('2031-04-14'),
}

const ctx = {
  proposer: 'PartyA::1220abc',
  counterparty: 'PartyB::1220abc',
  operator: 'Operator::1220abc',
  startDate: '2026-04-14',
  maturityDate: '2031-04-14',
}

function ccyLegs(base = 'USD', foreign = 'EUR'): LegConfig[] {
  return [
    {
      legType: 'fixed',
      direction: 'pay' as const,
      currency: base,
      notional: 10_000_000,
      rate: 0.04,
      dayCount: 'ACT_360',
      schedule: {
        startDate: dates.effectiveDate,
        endDate: dates.maturityDate,
        frequency: 'Quarterly',
      },
    },
    {
      legType: 'fixed',
      direction: 'receive' as const,
      currency: foreign,
      notional: 9_000_000,
      rate: 0.02,
      dayCount: 'ACT_360',
      schedule: {
        startDate: dates.effectiveDate,
        endDate: dates.maturityDate,
        frequency: 'Quarterly',
      },
    },
  ]
}

function fxLegs(base = 'USD', foreign = 'EUR'): LegConfig[] {
  return [
    {
      legType: 'fx',
      direction: 'pay' as const,
      baseCurrency: base,
      foreignCurrency: foreign,
      notional: 10_000_000,
      fxRate: 1.08,
      paymentDate: dates.effectiveDate,
    },
    {
      legType: 'fx',
      direction: 'receive' as const,
      baseCurrency: base,
      foreignCurrency: foreign,
      notional: 10_000_000,
      fxRate: 1.09,
      paymentDate: dates.maturityDate,
    },
  ]
}

describe('buildProposalPayload — operator injection', () => {
  test('IRS payload includes operator field', () => {
    const legs: LegConfig[] = [
      {
        legType: 'fixed',
        direction: 'receive',
        currency: 'USD',
        notional: 10_000_000,
        rate: 0.04,
        dayCount: 'ACT_360',
        schedule: {
          startDate: dates.effectiveDate,
          endDate: dates.maturityDate,
          frequency: 'Quarterly',
        },
      },
      {
        legType: 'float',
        direction: 'pay',
        currency: 'USD',
        notional: 10_000_000,
        indexId: 'SOFR/INDEX',
        spread: 0,
        dayCount: 'ACT_360',
        schedule: {
          startDate: dates.effectiveDate,
          endDate: dates.maturityDate,
          frequency: 'Quarterly',
        },
      },
    ]
    const result = buildProposalPayload('IRS', legs, ctx, dates)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.operator).toBe('Operator::1220abc')
      expect(result.payload.proposer).toBe('PartyA::1220abc')
    }
  })
})

describe('buildProposalPayload — CCY currency validation', () => {
  test('accepts a CCY proposal with configured currencies', () => {
    const result = buildProposalPayload(
      'CCY',
      ccyLegs('USD', 'EUR'),
      {
        ...ctx,
        allowedCurrencies: ['USD', 'EUR'],
      },
      dates,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.baseCurrency).toBe('USD')
      expect(result.payload.foreignCurrency).toBe('EUR')
    }
  })

  test('rejects a CCY proposal with an unseeded base currency (JPY)', () => {
    const result = buildProposalPayload(
      'CCY',
      ccyLegs('JPY', 'EUR'),
      {
        ...ctx,
        allowedCurrencies: ['USD', 'EUR'],
      },
      dates,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.field).toBe('baseCurrency')
      expect(result.message).toMatch(/JPY/)
    }
  })

  test('rejects a CCY proposal with an unseeded foreign currency', () => {
    const result = buildProposalPayload(
      'CCY',
      ccyLegs('USD', 'JPY'),
      {
        ...ctx,
        allowedCurrencies: ['USD', 'EUR'],
      },
      dates,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.field).toBe('foreignCurrency')
    }
  })

  test('skips validation when allowedCurrencies is omitted (legacy callers)', () => {
    const result = buildProposalPayload('CCY', ccyLegs('JPY', 'CHF'), ctx, dates)
    expect(result.ok).toBe(true)
  })
})

describe('buildProposalPayload — FX currency validation', () => {
  test('accepts an FX proposal with configured currencies', () => {
    const result = buildProposalPayload(
      'FX',
      fxLegs('USD', 'EUR'),
      {
        ...ctx,
        allowedCurrencies: ['USD', 'EUR'],
      },
      dates,
    )
    expect(result.ok).toBe(true)
  })

  test('rejects an FX proposal with an unseeded currency', () => {
    const result = buildProposalPayload(
      'FX',
      fxLegs('USD', 'JPY'),
      {
        ...ctx,
        allowedCurrencies: ['USD', 'EUR'],
      },
      dates,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.field).toBe('foreignCurrency')
    }
  })

  test('rejects FX when base currency is unseeded', () => {
    const result = buildProposalPayload(
      'FX',
      fxLegs('CHF', 'EUR'),
      {
        ...ctx,
        allowedCurrencies: ['USD', 'EUR'],
      },
      dates,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.field).toBe('baseCurrency')
  })

  test('FX payload carries both near (firstFxRate) and far (finalFxRate) legs', () => {
    const result = buildProposalPayload('FX', fxLegs('USD', 'EUR'), ctx, dates)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.firstFxRate).toBe(1.08)
      expect(result.payload.finalFxRate).toBe(1.09)
      expect(result.payload.firstPaymentDate).toBe('2026-04-14')
    }
  })
})
