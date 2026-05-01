import { describe, expect, test } from 'vitest'
import {
  type FpmlSwapStreamPayload,
  streamsToParsedFpml,
  streamToParsedLeg,
} from '../stream-payload.js'

const fixedLegFixture: FpmlSwapStreamPayload = {
  payerPartyReference: 'PartyA',
  receiverPartyReference: 'PartyB',
  calculationPeriodDates: {
    effectiveDate: { unadjustedDate: '2026-04-16' },
    terminationDate: { unadjustedDate: '2027-04-16' },
  },
  calculationPeriodAmount: {
    calculation: {
      notionalScheduleValue: {
        tag: 'NotionalSchedule_Regular',
        value: {
          id: 'NotionalA',
          notionalStepSchedule: { initialValue: '10000000', currency: 'USD' },
        },
      },
      rateTypeValue: {
        tag: 'RateType_Fixed',
        value: { initialValue: '0.045' },
      },
      dayCountFraction: 'Act360',
      compoundingMethodEnum: null,
    },
  },
}

const floatLegFixture: FpmlSwapStreamPayload = {
  ...fixedLegFixture,
  calculationPeriodAmount: {
    calculation: {
      ...fixedLegFixture.calculationPeriodAmount.calculation,
      rateTypeValue: {
        tag: 'RateType_Floating',
        value: {
          floatingRateIndex: 'USD-SOFR',
          spreadSchedule: [{ initialValue: '0.0025' }],
        },
      },
    },
  },
}

describe('streamToParsedLeg', () => {
  test('decodes a fixed leg', () => {
    const leg = streamToParsedLeg(fixedLegFixture)
    expect(leg).toEqual({
      currency: 'USD',
      notional: 10000000,
      rateType: 'fixed',
      fixedRate: 0.045,
      dayCountFraction: 'Act360',
    })
  })

  test('decodes a floating leg with spread', () => {
    const leg = streamToParsedLeg(floatLegFixture)
    expect(leg).toEqual({
      currency: 'USD',
      notional: 10000000,
      rateType: 'float',
      indexId: 'USD-SOFR',
      spread: 0.0025,
      dayCountFraction: 'Act360',
    })
  })

  test('rejects non-regular notional schedules', () => {
    const fx: FpmlSwapStreamPayload = {
      ...fixedLegFixture,
      calculationPeriodAmount: {
        calculation: {
          ...fixedLegFixture.calculationPeriodAmount.calculation,
          notionalScheduleValue: {
            tag: 'NotionalSchedule_FxLinked',
            value: {},
          },
        },
      },
    }
    expect(() => streamToParsedLeg(fx)).toThrow(/not supported/)
  })
})

describe('streamsToParsedFpml', () => {
  test('rejects empty stream arrays', () => {
    expect(() => streamsToParsedFpml([])).toThrow(/no swapStreams/)
  })

  test('preserves order + carries effective / termination dates', () => {
    const parsed = streamsToParsedFpml([fixedLegFixture, floatLegFixture])
    expect(parsed.legs).toHaveLength(2)
    expect(parsed.legs[0]?.rateType).toBe('fixed')
    expect(parsed.legs[1]?.rateType).toBe('float')
    expect(parsed.effectiveDate.toISOString().slice(0, 10)).toBe('2026-04-16')
    expect(parsed.terminationDate.toISOString().slice(0, 10)).toBe('2027-04-16')
  })
})
