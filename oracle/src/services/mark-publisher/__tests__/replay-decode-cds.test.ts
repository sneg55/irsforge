import type { FixedLegConfig, ProtectionLegConfig } from '@irsforge/shared-pricing'
import { describe, expect, it } from 'vitest'
import { mapCdsToSwapConfig } from '../replay-decode-cds.js'
import type { CdsInstrumentPayload, IrsInstrumentPayload } from '../replay-types.js'

const cdsFixture: CdsInstrumentPayload = {
  description: 'CDS TSLA 5mm',
  defaultProbabilityReferenceId: 'CDS/TSLA/DefaultProb',
  recoveryRateReferenceId: 'CDS/TSLA/Recovery',
  ownerReceivesFix: true,
  fixRate: '0.0125',
  periodicSchedule: {
    effectiveDate: '2026-04-17',
    terminationDate: '2031-04-17',
    firstRegularPeriodStartDate: null,
    lastRegularPeriodEndDate: null,
  },
  dayCountConvention: 'Act360',
  id: { unpack: 'cds-tsla-1' },
}

describe('mapCdsToSwapConfig', () => {
  it('produces a CDS SwapConfig with fixed (premium) + protection legs', () => {
    const cfg = mapCdsToSwapConfig(cdsFixture, 5_000_000)
    expect(cfg.type).toBe('CDS')
    expect(cfg.legs).toHaveLength(2)
    expect(cfg.legs[0].legType).toBe('fixed')
    expect(cfg.legs[1].legType).toBe('protection')
  })

  it('flips leg signs when ownerReceivesFix is false', () => {
    const cfg = mapCdsToSwapConfig({ ...cdsFixture, ownerReceivesFix: false }, 5_000_000)
    expect((cfg.legs[0] as FixedLegConfig).notional).toBe(-5_000_000)
    expect((cfg.legs[1] as ProtectionLegConfig).notional).toBe(5_000_000)
  })

  it('preserves the on-chain fixRate as the premium leg rate', () => {
    const cfg = mapCdsToSwapConfig(cdsFixture, 5_000_000)
    expect((cfg.legs[0] as FixedLegConfig).rate).toBe(0.0125)
  })

  it('hardcodes recoveryRate at 0.4 (matches app/use-blotter-valuation parity)', () => {
    const cfg = mapCdsToSwapConfig(cdsFixture, 5_000_000)
    expect((cfg.legs[1] as ProtectionLegConfig).recoveryRate).toBe(0.4)
  })

  it('rejects an unsupported day-count string', () => {
    const bad: CdsInstrumentPayload = { ...cdsFixture, dayCountConvention: 'BogusDc' }
    expect(() => mapCdsToSwapConfig(bad, 5_000_000)).toThrow(/unsupported dayCount/)
  })

  // Smoke check: shapes of CDS + IRS payloads diverge despite both being
  // V0 swap-instruments. Ensures we don't accidentally alias types.
  it('CDS payload shape is structurally distinct from IRS payload', () => {
    const irsLike: Partial<IrsInstrumentPayload> = { floatingRate: { referenceRateId: 'X' } }
    expect('floatingRate' in cdsFixture).toBe(false)
    expect('defaultProbabilityReferenceId' in irsLike).toBe(false)
  })
})
