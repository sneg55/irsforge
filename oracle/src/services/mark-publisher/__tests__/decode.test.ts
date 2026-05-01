import { describe, expect, it } from 'vitest'
import type { CsaPayload } from '../../../shared/types.js'
import { decodeCsa } from '../decode.js'

const baseRaw: CsaPayload = {
  operator: 'Op',
  partyA: 'PA',
  partyB: 'PB',
  regulators: ['Reg'],
  scheduler: 'Sched',
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
  it('parses Daml Map array form into JS Map<string,number>', () => {
    const c = decodeCsa('cid1', baseRaw)
    expect(c.thresholdDirA).toBe(0)
    expect(c.thresholdDirB).toBe(0)
    expect(c.mta).toBe(100_000)
    // Positive csb ⇒ A pledged; the decoder routes the amount to postedByA.
    expect(c.postedByA.get('USD')).toBe(5_000_000)
    expect(c.postedByB.get('USD') ?? 0).toBe(0)
    expect(c.state).toBe('Active')
  })

  it('flips a negative csb onto postedByB (B is pledgor)', () => {
    const c = decodeCsa('cid1', { ...baseRaw, csb: [['USD', '-3000000.0']] })
    expect(c.postedByA.get('USD') ?? 0).toBe(0)
    expect(c.postedByB.get('USD')).toBe(3_000_000)
  })

  it('throws when threshold arrives as Record (Canton v1 quirk)', () => {
    const malformed = { ...baseRaw, threshold: { DirA: '0.0', DirB: '0.0' } as never }
    expect(() => decodeCsa('cid1', malformed)).toThrow(/not in array form/)
  })

  it('throws when DirA missing', () => {
    const malformed = {
      ...baseRaw,
      threshold: [['DirB', '0.0']] as CsaPayload['threshold'],
    }
    expect(() => decodeCsa('cid1', malformed)).toThrow(/DirA/)
  })
})
