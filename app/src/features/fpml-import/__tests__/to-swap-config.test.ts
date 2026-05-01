import { describe, expect, it } from 'vitest'
import { typedProposalToSwapConfig } from '../to-swap-config'
import type { TypedProposal } from '../types'

describe('typedProposalToSwapConfig', () => {
  it('IRS: two legs (fixed, float), shared currency, Quarterly schedule', () => {
    const proposal: TypedProposal = {
      type: 'IRS',
      payload: {
        notional: 10_000_000,
        currency: 'USD',
        fixRate: 0.0425,
        floatingRateId: 'USD-LIBOR-3M',
        floatingSpread: 0,
        startDate: '2026-04-16',
        maturityDate: '2031-04-16',
        dayCount: 'Act360',
        fixedDirection: 'receive',
      },
    }
    const config = typedProposalToSwapConfig(proposal)
    expect(config.type).toBe('IRS')
    expect(config.legs).toHaveLength(2)

    const [fixed, float] = config.legs
    expect(fixed.legType).toBe('fixed')
    if (fixed.legType !== 'fixed') throw new Error()
    expect(fixed.rate).toBe(0.0425)
    expect(fixed.notional).toBe(10_000_000)
    expect(fixed.currency).toBe('USD')
    expect(fixed.dayCount).toBe('ACT_360')
    expect(fixed.schedule.frequency).toBe('Quarterly')

    expect(float.legType).toBe('float')
    if (float.legType !== 'float') throw new Error()
    expect(float.indexId).toBe('USD-LIBOR-3M')
  })

  it('OIS: Annual-frequency schedule', () => {
    const proposal: TypedProposal = {
      type: 'OIS',
      payload: {
        notional: 25_000_000,
        currency: 'USD',
        fixRate: 0.035,
        floatingRateId: 'USD-SOFR',
        floatingSpread: 0,
        startDate: '2026-04-16',
        maturityDate: '2031-04-16',
        dayCount: 'Act360',
        fixedDirection: 'receive',
      },
    }
    const config = typedProposalToSwapConfig(proposal)
    const firstLeg = config.legs[0]
    if (!('schedule' in firstLeg) || !firstLeg.schedule) throw new Error('expected schedule')
    expect(firstLeg.schedule.frequency).toBe('Annual')
  })

  it('BASIS: two float legs, same currency, per-leg spreads preserved', () => {
    const proposal: TypedProposal = {
      type: 'BASIS',
      payload: {
        notional: 50_000_000,
        currency: 'USD',
        leg0IndexId: 'USD-SOFR',
        leg1IndexId: 'USD-EFFR',
        leg0Spread: 0,
        leg1Spread: 0.0015,
        startDate: '2026-04-16',
        maturityDate: '2029-04-16',
        dayCount: 'Act360',
        leg0Direction: 'pay',
      },
    }
    const config = typedProposalToSwapConfig(proposal)
    expect(config.legs).toHaveLength(2)
    for (const leg of config.legs) {
      expect(leg.legType).toBe('float')
    }
    if (config.legs[0].legType !== 'float' || config.legs[1].legType !== 'float') throw new Error()
    expect(config.legs[0].indexId).toBe('USD-SOFR')
    expect(config.legs[1].indexId).toBe('USD-EFFR')
    expect(config.legs[1].spread).toBe(0.0015)
  })

  it('XCCY: fixed + float across currencies, SemiAnnual schedule', () => {
    const proposal: TypedProposal = {
      type: 'XCCY',
      payload: {
        fixedCurrency: 'USD',
        fixedNotional: 10_000_000,
        fixedRate: 0.042,
        floatCurrency: 'EUR',
        floatNotional: 9_259_259,
        floatIndexId: 'EUR-ESTR',
        floatSpread: 0,
        startDate: '2026-04-16',
        maturityDate: '2031-04-16',
        dayCount: 'Act360',
        fixedDirection: 'receive',
      },
    }
    const config = typedProposalToSwapConfig(proposal)
    expect(config.legs).toHaveLength(2)
    expect(config.legs[0].legType).toBe('fixed')
    if (config.legs[0].legType !== 'fixed' || config.legs[1].legType !== 'float') throw new Error()
    expect(config.legs[0].currency).toBe('USD')
    expect(config.legs[0].notional).toBe(10_000_000)
    expect(config.legs[1].currency).toBe('EUR')
    expect(config.legs[1].notional).toBe(9_259_259)
    expect(config.legs[0].schedule.frequency).toBe('SemiAnnual')
  })
})
