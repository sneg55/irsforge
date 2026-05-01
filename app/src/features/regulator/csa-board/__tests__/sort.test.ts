import { describe, expect, it } from 'vitest'
import type { CsaViewModel } from '@/features/csa/decode'
import { sortCsasByFriction } from '../sort'

function csa(state: CsaViewModel['state'], posted = 0): CsaViewModel {
  return {
    contractId: state + posted,
    operator: 'Op',
    partyA: 'A',
    partyB: 'B',
    regulators: ['R'],
    thresholdDirA: 0,
    thresholdDirB: 0,
    mta: 0,
    rounding: 0,
    valuationCcy: 'USD',
    postedByA: new Map([['USD', posted]]),
    postedByB: new Map(),
    state,
    lastMarkCid: null,
    activeDispute: null,
    isdaMasterAgreementRef: '',
    governingLaw: 'NewYork',
    imAmount: 0,
  }
}

describe('sortCsasByFriction', () => {
  it('puts MarkDisputed first, MarginCallOutstanding second, Active last', () => {
    const sorted = sortCsasByFriction([
      csa('Active', 100),
      csa('MarkDisputed', 50),
      csa('MarginCallOutstanding', 75),
    ])
    expect(sorted.map((c) => c.state)).toEqual(['MarkDisputed', 'MarginCallOutstanding', 'Active'])
  })

  it('breaks ties within a state by magnitude descending', () => {
    const sorted = sortCsasByFriction([csa('Active', 100), csa('Active', 1000), csa('Active', 500)])
    expect(sorted.map((c) => Math.round(c.postedByA.get('USD') ?? 0))).toEqual([1000, 500, 100])
  })

  it('does not mutate input array', () => {
    const input = [csa('Active', 100), csa('MarkDisputed')]
    const inputClone = [...input]
    sortCsasByFriction(input)
    expect(input).toEqual(inputClone)
  })

  it('Escalated rises above MarkDisputed (operator window worse than bilateral)', () => {
    const sorted = sortCsasByFriction([
      csa('Active', 100),
      csa('MarkDisputed', 50),
      csa('Escalated', 25),
      csa('MarginCallOutstanding', 75),
    ])
    expect(sorted.map((c) => c.state)).toEqual([
      'Escalated',
      'MarkDisputed',
      'MarginCallOutstanding',
      'Active',
    ])
  })
})
