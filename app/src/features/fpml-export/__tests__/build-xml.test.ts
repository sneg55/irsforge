import { describe, expect, it } from 'vitest'
import { buildProposalFromClassification } from '../../fpml-import/build-proposal'
import { classify, parseFpml } from '../../fpml-import/classify'
import type { TypedProposal } from '../../fpml-import/types'
import { buildFpmlXml } from '../build-xml'

function roundTrip(original: TypedProposal): TypedProposal {
  const xml = buildFpmlXml(original)
  const parsed = parseFpml(xml)
  const cls = classify(parsed)
  return buildProposalFromClassification(cls, parsed.effectiveDate, parsed.terminationDate)
}

describe('buildFpmlXml', () => {
  it('emits a well-formed XML string with <FpML> root and swapStream children', () => {
    const xml = buildFpmlXml({
      type: 'IRS',
      payload: {
        notional: 10_000_000,
        currency: 'USD',
        fixRate: 0.04,
        floatingRateId: 'USD-LIBOR-3M',
        floatingSpread: 0,
        startDate: '2026-04-16',
        maturityDate: '2031-04-16',
        dayCount: 'Act360',
        fixedDirection: 'receive',
      },
    })
    expect(xml).toContain('<FpML')
    expect(xml).toContain('<swapStream>')
    expect(xml).toContain('<floatingRateIndex>USD-LIBOR-3M</floatingRateIndex>')
    expect(xml).toContain('<initialValue>0.04</initialValue>')
  })

  it('round-trips IRS fixed leg direction through party refs', () => {
    // Use a non-overnight index so round-trip classifies back as IRS (not OIS).
    const proposal: TypedProposal = {
      type: 'IRS',
      payload: {
        notional: 50_000_000,
        currency: 'USD',
        fixRate: 0.04,
        floatingRateId: 'USD-LIBOR-3M',
        floatingSpread: 0,
        startDate: '2026-04-21',
        maturityDate: '2031-04-21',
        dayCount: 'Act360',
        fixedDirection: 'receive',
      },
    }
    const xml = buildFpmlXml(proposal)
    // Party refs are emitted at swapStream level, before calculationPeriodDates.
    // fixed leg stream: owner (party1) receives fixed → payer=party2, receiver=party1
    expect(xml).toMatch(/receiverPartyReference[^>]*href="party1"[\s\S]*?fixedRateSchedule/)
    expect(xml).toMatch(/payerPartyReference[^>]*href="party2"[\s\S]*?fixedRateSchedule/)
    // float leg stream: opposite → party1 pays float
    expect(xml).toMatch(/payerPartyReference[^>]*href="party1"[\s\S]*?floatingRateCalculation/)
    expect(xml).toMatch(/receiverPartyReference[^>]*href="party2"[\s\S]*?floatingRateCalculation/)

    // import side: round-trip preserves fixedDirection
    const rt = roundTrip(proposal)
    expect(rt).toEqual(proposal)
    expect(
      rt.type === 'IRS' || rt.type === 'OIS'
        ? (rt as { payload: { fixedDirection: string } }).payload.fixedDirection
        : null,
    ).toBe('receive')
  })

  it('round-trips IRS fixedDirection=pay through party refs', () => {
    const proposal: TypedProposal = {
      type: 'IRS',
      payload: {
        notional: 50_000_000,
        currency: 'USD',
        fixRate: 0.04,
        floatingRateId: 'USD-LIBOR-3M',
        floatingSpread: 0,
        startDate: '2026-04-21',
        maturityDate: '2031-04-21',
        dayCount: 'Act360',
        fixedDirection: 'pay',
      },
    }
    const xml = buildFpmlXml(proposal)
    // fixed leg stream: owner (party1) pays fixed → payer=party1, receiver=party2
    expect(xml).toMatch(/payerPartyReference[^>]*href="party1"[\s\S]*?fixedRateSchedule/)
    expect(xml).toMatch(/receiverPartyReference[^>]*href="party2"[\s\S]*?fixedRateSchedule/)
    expect(roundTrip(proposal)).toEqual(proposal)
  })
})

describe('round-trip', () => {
  it('IRS: TypedProposal → XML → parse → classify → TypedProposal is identity', () => {
    const original: TypedProposal = {
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
    expect(roundTrip(original)).toEqual(original)
  })

  it('OIS: SOFR + CompoundedInArrears round-trips as OIS (not IRS)', () => {
    const original: TypedProposal = {
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
    expect(roundTrip(original)).toEqual(original)
  })

  it('BASIS: two floats (SOFR + EFFR), same currency round-trips', () => {
    const original: TypedProposal = {
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
    expect(roundTrip(original)).toEqual(original)
  })

  it('XCCY: fixed USD + float EUR (different currencies) round-trips', () => {
    const original: TypedProposal = {
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
    expect(roundTrip(original)).toEqual(original)
  })
})
