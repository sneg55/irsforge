import {
  type FpmlSwapStreamPayload,
  parsedFpmlToSwapConfig,
  streamsToParsedFpml,
} from '@irsforge/shared-pricing'
import { describe, expect, it } from 'vitest'

const dates = {
  effectiveDate: { unadjustedDate: '2026-01-01' },
  terminationDate: { unadjustedDate: '2031-01-01' },
}

function regularNotional(initialValue: string, currency: string) {
  return {
    tag: 'NotionalSchedule_Regular' as const,
    value: { id: 'calc', notionalStepSchedule: { initialValue, currency } },
  }
}

function fixedStream(currency: string, notional: string, rate: string): FpmlSwapStreamPayload {
  return {
    payerPartyReference: 'A',
    receiverPartyReference: 'B',
    calculationPeriodDates: dates,
    calculationPeriodAmount: {
      calculation: {
        notionalScheduleValue: regularNotional(notional, currency),
        rateTypeValue: { tag: 'RateType_Fixed', value: { initialValue: rate } },
        dayCountFraction: 'Act360',
        compoundingMethodEnum: null,
      },
    },
  }
}

function floatStream(
  currency: string,
  notional: string,
  indexId: string,
  spread = '0',
): FpmlSwapStreamPayload {
  return {
    payerPartyReference: 'B',
    receiverPartyReference: 'A',
    calculationPeriodDates: dates,
    calculationPeriodAmount: {
      calculation: {
        notionalScheduleValue: regularNotional(notional, currency),
        rateTypeValue: {
          tag: 'RateType_Floating',
          value: {
            floatingRateIndex: indexId,
            spreadSchedule: spread === '0' ? [] : [{ initialValue: spread }],
          },
        },
        dayCountFraction: 'Act360',
        compoundingMethodEnum: null,
      },
    },
  }
}

function cfg(streams: FpmlSwapStreamPayload[]) {
  return parsedFpmlToSwapConfig(streamsToParsedFpml(streams))
}

describe('parsedFpmlToSwapConfig', () => {
  it('BASIS — two floats same ccy → BASIS SwapConfig (two float legs, signs flipped)', () => {
    const result = cfg([
      floatStream('USD', '10000000', 'USD-LIBOR-3M'),
      floatStream('USD', '10000000', 'USD-EFFR', '0.0015'),
    ])
    expect(result.type).toBe('BASIS')
    expect(result.legs).toHaveLength(2)
    expect(result.legs[0].legType).toBe('float')
    expect(result.legs[1].legType).toBe('float')
    expect((result.legs[0] as { notional: number }).notional).toBe(10_000_000)
    expect((result.legs[1] as { notional: number }).notional).toBe(-10_000_000)
  })

  it('XCCY — fixed USD + float EUR → XCCY SwapConfig with two ccies', () => {
    const result = cfg([
      fixedStream('USD', '10000000', '0.04'),
      floatStream('EUR', '9000000', 'EUR-ESTR'),
    ])
    expect(result.type).toBe('XCCY')
    expect(result.legs[0].legType).toBe('fixed')
    expect((result.legs[0] as { currency: string }).currency).toBe('USD')
    expect((result.legs[1] as { currency: string }).currency).toBe('EUR')
  })

  it('FpML-IRS — fixed + non-overnight float same ccy → IRS SwapConfig', () => {
    const result = cfg([
      fixedStream('USD', '10000000', '0.04'),
      floatStream('USD', '10000000', 'USD-LIBOR-3M'),
    ])
    expect(result.type).toBe('IRS')
    expect(result.legs[0].legType).toBe('fixed')
    expect(result.legs[1].legType).toBe('float')
  })

  it('rejects unsupported leg shapes (single fixed leg)', () => {
    expect(() => cfg([fixedStream('USD', '10000000', '0.04')])).toThrow(/stream count/i)
  })

  it('preserves on-chain dates as effective + maturity', () => {
    const result = cfg([
      fixedStream('USD', '10000000', '0.04'),
      floatStream('USD', '10000000', 'USD-LIBOR-3M'),
    ])
    expect(result.effectiveDate.toISOString().slice(0, 10)).toBe('2026-01-01')
    expect(result.maturityDate.toISOString().slice(0, 10)).toBe('2031-01-01')
  })
})
