import type { FixedLegConfig, FloatLegConfig } from '@irsforge/shared-pricing'

export const dates = {
  effectiveDate: new Date('2026-04-14'),
  maturityDate: new Date('2031-04-14'),
}

export const ctx = {
  proposer: 'PartyA::1220abc',
  counterparty: 'PartyB::1220abc',
  operator: 'Operator::1220abc',
  startDate: '2026-04-14',
  maturityDate: '2031-04-14',
}

const schedule = {
  startDate: dates.effectiveDate,
  endDate: dates.maturityDate,
  frequency: 'Quarterly' as const,
}

export function fixedLeg(rate = 0.04, ccy = 'USD', notional = 10_000_000): FixedLegConfig {
  return {
    legType: 'fixed',
    direction: 'receive',
    currency: ccy,
    notional,
    rate,
    dayCount: 'ACT_360',
    schedule,
  }
}

export function floatLeg(ccy = 'USD', notional = 10_000_000): FloatLegConfig {
  return {
    legType: 'float',
    direction: 'pay',
    currency: ccy,
    notional,
    indexId: 'USD-SOFR',
    spread: 0,
    dayCount: 'ACT_360',
    schedule,
  }
}
