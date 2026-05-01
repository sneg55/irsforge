import { describe, expect, it } from 'vitest'
import type { CsaPayload } from '@/shared/ledger/types'
import { decodeCsa, decodeMark } from './decode'

const baseRaw: CsaPayload = {
  operator: 'Op',
  partyA: 'PA',
  partyB: 'PB',
  regulators: ['Reg'],
  scheduler: 'Sch',
  threshold: [
    ['DirA', '0.0'],
    ['DirB', '0.0'],
  ],
  mta: '100000.0',
  rounding: '10000.0',
  eligible: [{ currency: 'USD', haircut: '1.0' }],
  valuationCcy: 'USD',
  csb: [['USD', '5000000.0']],
  state: 'Active',
  lastMarkCid: null,
  activeDispute: null,
  isdaMasterAgreementRef: '',
  governingLaw: 'NewYork',
  imAmount: '0',
}

describe('decodeCsa', () => {
  it('parses Daml Map array form', () => {
    const c = decodeCsa('cid1', baseRaw)
    expect(c.thresholdDirA).toBe(0)
    expect(c.state).toBe('Active')
  })

  it('derives postedByA from a positive csb (A is pledgor)', () => {
    const c = decodeCsa('cid1', baseRaw)
    expect(c.postedByA.get('USD')).toBe(5_000_000)
    expect(c.postedByB.get('USD') ?? 0).toBe(0)
  })

  it('derives postedByB from a negative csb (B is pledgor)', () => {
    const c = decodeCsa('cid1', { ...baseRaw, csb: [['USD', '-3000000.0']] })
    expect(c.postedByA.get('USD') ?? 0).toBe(0)
    expect(c.postedByB.get('USD')).toBe(3_000_000)
  })
  it('throws on Record-form Map', () => {
    const malformed = { ...baseRaw, threshold: { DirA: '0' } as unknown as CsaPayload['threshold'] }
    expect(() => decodeCsa('cid1', malformed)).toThrow(/Record/)
  })
  it('throws when threshold is missing DirA or DirB', () => {
    const missing = { ...baseRaw, threshold: [['DirA', '0.0']] as CsaPayload['threshold'] }
    expect(() => decodeCsa('cid1', missing)).toThrow(/DirA\/DirB/)
  })
  it('round-trips ISDA MA ref + governing law + IM amount', () => {
    const c = decodeCsa('cid1', {
      ...baseRaw,
      isdaMasterAgreementRef: 'ISDA-2002-DEMO',
      governingLaw: 'English',
      imAmount: '25000000',
    })
    expect(c.isdaMasterAgreementRef).toBe('ISDA-2002-DEMO')
    expect(c.governingLaw).toBe('English')
    expect(c.imAmount).toBe(25_000_000)
  })
})

describe('decodeMark', () => {
  it('parses signed exposure', () => {
    const m = decodeMark('mc1', {
      operator: 'Op',
      partyA: 'PA',
      partyB: 'PB',
      regulators: ['Reg'],
      scheduler: 'Sch',
      csaCid: 'cid1',
      asOf: '2026-04-17T12:00:00Z',
      exposure: '-123456.78',
      snapshot: '{}',
    })
    expect(m.exposure).toBeCloseTo(-123_456.78, 2)
    expect(m.csaCid).toBe('cid1')
  })
})
