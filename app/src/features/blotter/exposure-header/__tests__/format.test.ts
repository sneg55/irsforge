import { describe, expect, it } from 'vitest'
import {
  compactCurrency,
  coverageFraction,
  csaStatusColorClass,
  deriveCsaStatus,
  formatAsOf,
  formatCoveragePct,
  fullCurrency,
  TYPE_CHIP_ORDER,
} from '../format'

describe('compactCurrency', () => {
  it('formats millions with M suffix', () => {
    expect(compactCurrency(60_000_000)).toBe('$60M')
  })
  it('formats thousands with K suffix', () => {
    expect(compactCurrency(23_400)).toBe('$23.4K')
  })
  it('preserves sign for negatives', () => {
    expect(compactCurrency(-10_000_000)).toBe('-$10M')
  })
  it('returns $0 for zero', () => {
    expect(compactCurrency(0)).toBe('$0')
  })
})

describe('fullCurrency', () => {
  it('renders integer dollars with commas', () => {
    expect(fullCurrency(19_800_000)).toBe('$19,800,000')
  })
})

describe('formatCoveragePct', () => {
  it('returns the ratio of own-posted to exposure', () => {
    expect(formatCoveragePct(5_000_000, 10_000_000)).toBe('50%')
    expect(formatCoveragePct(10_000_000, 10_000_000)).toBe('100%')
    expect(formatCoveragePct(20_000_000, 10_000_000)).toBe('200%')
  })
  it('returns 0% when own-posted is zero but exposure is positive', () => {
    expect(formatCoveragePct(0, 5_000_000)).toBe('0%')
  })
  it('returns "—" when exposure is unknown (no mark)', () => {
    expect(formatCoveragePct(10_000_000, null)).toBe('—')
  })
  it('returns "—" when active party is in-the-money (exposure ≤ 0)', () => {
    expect(formatCoveragePct(10_000_000, -5_000_000)).toBe('—')
    expect(formatCoveragePct(10_000_000, 0)).toBe('—')
  })
})

describe('coverageFraction', () => {
  it('caps at 1 when over-posted', () => {
    expect(coverageFraction(20_000_000, 5_000_000)).toBe(1)
  })
  it('returns the exposure ratio when under-posted', () => {
    expect(coverageFraction(2_500_000, 5_000_000)).toBe(0.5)
  })
  it('returns null when exposure is unknown', () => {
    expect(coverageFraction(1_000_000, null)).toBeNull()
  })
  it('returns 1 (nothing needed) when active party is in-the-money', () => {
    expect(coverageFraction(0, -1_000_000)).toBe(1)
  })
})

describe('deriveCsaStatus', () => {
  it('returns call when ledger state is MarginCallOutstanding regardless of coverage', () => {
    expect(deriveCsaStatus('MarginCallOutstanding', 10_000_000, 5_000_000)).toBe('call')
    expect(deriveCsaStatus('MarginCallOutstanding', 0, null)).toBe('call')
  })
  it('returns disputed when ledger state is MarkDisputed', () => {
    expect(deriveCsaStatus('MarkDisputed', 10_000_000, 1_000_000)).toBe('disputed')
  })
  it('returns unknown when Active but no mark is published', () => {
    expect(deriveCsaStatus('Active', 10_000_000, null)).toBe('unknown')
  })
  it('returns healthy when Active and coverage ≥ 100%', () => {
    expect(deriveCsaStatus('Active', 10_000_000, 5_000_000)).toBe('healthy')
  })
  it('returns warn when Active and coverage in [80%, 100%)', () => {
    expect(deriveCsaStatus('Active', 8_500_000, 10_000_000)).toBe('warn')
  })
  it('returns call when Active and coverage < 80%', () => {
    expect(deriveCsaStatus('Active', 5_000_000, 10_000_000)).toBe('call')
  })
  it('returns healthy when Active and active party is in-the-money', () => {
    expect(deriveCsaStatus('Active', 0, -5_000_000)).toBe('healthy')
  })
  it('returns escalated when ledger state is Escalated (overrides disputed)', () => {
    expect(deriveCsaStatus('Escalated', 10_000_000, 1_000_000)).toBe('escalated')
  })
})

describe('csaStatusColorClass', () => {
  it('labels MarginCallOutstanding as "Margin Call" (ISDA-aligned wording)', () => {
    expect(csaStatusColorClass('call').label).toBe('Margin Call')
  })
  it('labels unknown as "Awaiting mark" — honest placeholder, not a fake status', () => {
    expect(csaStatusColorClass('unknown').label).toBe('Awaiting mark')
  })
  it('labels escalated', () => {
    expect(csaStatusColorClass('escalated').label).toBe('Escalated')
  })
})

describe('TYPE_CHIP_ORDER', () => {
  it('lists IRS, OIS, BASIS, XCCY, CDS in that order', () => {
    expect(TYPE_CHIP_ORDER).toEqual(['IRS', 'OIS', 'BASIS', 'XCCY', 'CDS'])
  })
})

describe('formatAsOf', () => {
  it('renders ISO timestamps in HH:MM:SS UTC', () => {
    expect(formatAsOf('2026-04-27T13:45:09.123Z')).toBe('as of 13:45:09 UTC')
  })
  it('zero-pads single-digit clock components', () => {
    expect(formatAsOf('2026-04-27T03:05:07Z')).toBe('as of 03:05:07 UTC')
  })
  it('renders an em-dash placeholder when timestamp is null/undefined', () => {
    expect(formatAsOf(null)).toBe('as of —')
    expect(formatAsOf(undefined)).toBe('as of —')
  })
  it('renders an em-dash placeholder when the timestamp does not parse', () => {
    expect(formatAsOf('not-a-date')).toBe('as of —')
  })
})
