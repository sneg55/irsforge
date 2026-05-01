import { describe, expect, test } from 'vitest'
import { computeCallSignal } from '../call-amount'
import type { CsaViewModel } from '../decode'

function csa(overrides: Partial<CsaViewModel> = {}): CsaViewModel {
  return {
    contractId: 'cid',
    operator: 'op',
    partyA: 'A',
    partyB: 'B',
    regulators: [],
    thresholdDirA: 0,
    thresholdDirB: 0,
    mta: 100_000,
    rounding: 10_000,
    valuationCcy: 'USD',
    postedByA: new Map<string, number>([['USD', 0]]),
    postedByB: new Map<string, number>([['USD', 0]]),
    state: 'Active',
    lastMarkCid: null,
    activeDispute: null,
    isdaMasterAgreementRef: '',
    governingLaw: 'NewYork',
    imAmount: 0,
    ...overrides,
  }
}

describe('computeCallSignal', () => {
  test('A owes when exposure positive and nothing posted', () => {
    const sig = computeCallSignal(csa(), 1_000_000)
    expect(sig).toEqual({ side: 'A', amount: 1_000_000 })
  })

  test('B owes when exposure negative and nothing posted', () => {
    const sig = computeCallSignal(csa(), -1_000_000)
    expect(sig).toEqual({ side: 'B', amount: 1_000_000 })
  })

  test('returns null when gross delta is below MTA', () => {
    expect(computeCallSignal(csa({ mta: 100_000 }), 50_000)).toBeNull()
  })

  test('snaps to rounding increment', () => {
    const sig = computeCallSignal(csa({ rounding: 25_000 }), 1_237_500)
    expect(sig).toEqual({ side: 'A', amount: 1_250_000 })
  })

  test('threshold absorbs the call when exposure < threshold', () => {
    // exposure 200k, B's threshold (the buffer before A pledges) 250k → no
    // call required from A.
    expect(computeCallSignal(csa({ thresholdDirB: 250_000 }), 200_000)).toBeNull()
  })

  test('current pledge nets against target', () => {
    // exposure 1M ⇒ A should pledge 1M. A already posted 600k ⇒ open call 400k.
    const c = csa({ postedByA: new Map([['USD', 600_000]]) })
    expect(computeCallSignal(c, 1_000_000)).toEqual({ side: 'A', amount: 400_000 })
  })

  test('over-pledged side gets a return signal', () => {
    // exposure 0, A has 500k posted ⇒ A is over-pledged ⇒ B-side movement
    // (collateral flows back to A). Gated above MTA, snapped to rounding.
    const c = csa({ postedByA: new Map([['USD', 500_000]]) })
    expect(computeCallSignal(c, 0)).toEqual({ side: 'B', amount: 500_000 })
  })

  test('demo regression: A pre-pledged but exposure flipped to A-favourable', () => {
    // Reproduces the demo screenshot: exposure -8.48M (B owes A),
    // postedByA = 5M (A pre-funded earlier when A was OTM), thresholds 0,
    // MTA 100k, rounding 10k. Net call: B must move 13.48M → 13_480_000.
    const c = csa({ postedByA: new Map([['USD', 5_000_000]]) })
    const sig = computeCallSignal(c, -8_478_609)
    expect(sig?.side).toBe('B')
    expect(sig?.amount).toBe(13_480_000)
  })
})
