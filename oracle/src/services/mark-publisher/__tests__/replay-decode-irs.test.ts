import { describe, expect, it } from 'vitest'
import { mapIrsToSwapConfig } from '../replay-decode-irs.js'
import type { IrsInstrumentPayload } from '../replay-types.js'

describe('mapIrsToSwapConfig', () => {
  it('flips leg signs when ownerReceivesFix is false', () => {
    const payload: IrsInstrumentPayload = {
      description: 'IRS 10mm',
      floatingRate: { referenceRateId: 'USD-SOFR' },
      ownerReceivesFix: false,
      fixRate: '0.04',
      periodicSchedule: {
        effectiveDate: '2026-04-17',
        terminationDate: '2031-04-17',
        firstRegularPeriodStartDate: null,
        lastRegularPeriodEndDate: null,
      },
      dayCountConvention: 'Act360',
      id: { unpack: 'inst-1' },
    }
    const cfg = mapIrsToSwapConfig(payload, 10_000_000)
    expect(cfg.type).toBe('IRS')
    expect(cfg.legs[0].legType).toBe('fixed')
    // ownerReceivesFix=false → pay fix, receive float
    // Fixed notional should be NEGATIVE (paying out), float POSITIVE (receiving).
    expect((cfg.legs[0] as { notional: number }).notional).toBe(-10_000_000)
    expect((cfg.legs[1] as { notional: number }).notional).toBe(10_000_000)
  })

  it('rejects an unsupported day-count string', () => {
    const payload: IrsInstrumentPayload = {
      description: 'IRS',
      floatingRate: { referenceRateId: 'USD-SOFR' },
      ownerReceivesFix: true,
      fixRate: '0.04',
      periodicSchedule: {
        effectiveDate: '2026-04-17',
        terminationDate: '2031-04-17',
        firstRegularPeriodStartDate: null,
        lastRegularPeriodEndDate: null,
      },
      dayCountConvention: 'BogusDayCount',
      id: { unpack: 'inst-2' },
    }
    expect(() => mapIrsToSwapConfig(payload, 10_000_000)).toThrow(/unsupported dayCount/)
  })
})
