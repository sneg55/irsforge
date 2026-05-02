import { afterEach, describe, expect, test, vi } from 'vitest'
import { deriveHealth, type LedgerHealthSnapshot, ledgerHealthBus } from '../health-bus'

afterEach(() => {
  ledgerHealthBus.resetForTesting()
})

describe('deriveHealth', () => {
  test('idle when no calls observed', () => {
    const snapshot: LedgerHealthSnapshot = {
      lastSuccessAt: null,
      lastFailureAt: null,
      consecutiveFailures: 0,
    }
    expect(deriveHealth(snapshot)).toBe('idle')
  })

  test('live after a single successful call', () => {
    const snapshot: LedgerHealthSnapshot = {
      lastSuccessAt: 1000,
      lastFailureAt: null,
      consecutiveFailures: 0,
    }
    expect(deriveHealth(snapshot)).toBe('live')
  })

  test('live when failures recorded but recent success reset the streak', () => {
    const snapshot: LedgerHealthSnapshot = {
      lastSuccessAt: 2000,
      lastFailureAt: 1000,
      consecutiveFailures: 0,
    }
    expect(deriveHealth(snapshot)).toBe('live')
  })

  test('still live below the consecutive-failure threshold', () => {
    const snapshot: LedgerHealthSnapshot = {
      lastSuccessAt: 1000,
      lastFailureAt: 2000,
      consecutiveFailures: 2,
    }
    expect(deriveHealth(snapshot)).toBe('live')
  })

  test('down once consecutive failures hit the threshold', () => {
    const snapshot: LedgerHealthSnapshot = {
      lastSuccessAt: 1000,
      lastFailureAt: 2000,
      consecutiveFailures: 3,
    }
    expect(deriveHealth(snapshot)).toBe('down')
  })

  test('still down even with a prior success — streak is what matters', () => {
    const snapshot: LedgerHealthSnapshot = {
      lastSuccessAt: 100,
      lastFailureAt: 5000,
      consecutiveFailures: 7,
    }
    expect(deriveHealth(snapshot)).toBe('down')
  })
})

describe('ledgerHealthBus', () => {
  test('starts idle', () => {
    expect(deriveHealth(ledgerHealthBus.getSnapshot())).toBe('idle')
  })

  test('record success notifies subscribers and flips to live', () => {
    const seen: string[] = []
    const unsubscribe = ledgerHealthBus.subscribe((s) => {
      seen.push(deriveHealth(s))
    })

    ledgerHealthBus.recordSuccess(1000)
    expect(seen).toEqual(['live'])
    expect(deriveHealth(ledgerHealthBus.getSnapshot())).toBe('live')

    unsubscribe()
  })

  test('three consecutive failures flip to down; one success resets', () => {
    ledgerHealthBus.recordFailure(1000)
    expect(deriveHealth(ledgerHealthBus.getSnapshot())).toBe('live')

    ledgerHealthBus.recordFailure(2000)
    expect(deriveHealth(ledgerHealthBus.getSnapshot())).toBe('live')

    ledgerHealthBus.recordFailure(3000)
    expect(deriveHealth(ledgerHealthBus.getSnapshot())).toBe('down')

    ledgerHealthBus.recordSuccess(4000)
    expect(deriveHealth(ledgerHealthBus.getSnapshot())).toBe('live')
    expect(ledgerHealthBus.getSnapshot().consecutiveFailures).toBe(0)
  })

  test('unsubscribed listener is not called again', () => {
    const seen: number[] = []
    const unsubscribe = ledgerHealthBus.subscribe(() => {
      seen.push(seen.length)
    })

    ledgerHealthBus.recordSuccess(1000)
    expect(seen).toHaveLength(1)

    unsubscribe()
    ledgerHealthBus.recordFailure(2000)
    expect(seen).toHaveLength(1)
  })

  test('a throwing subscriber does not block siblings', () => {
    const calls: string[] = []
    const u1 = ledgerHealthBus.subscribe(() => {
      throw new Error('subscriber boom')
    })
    const u2 = ledgerHealthBus.subscribe(() => {
      calls.push('after-throw')
    })

    expect(() => {
      ledgerHealthBus.recordSuccess(1000)
    }).not.toThrow()
    expect(calls).toEqual(['after-throw'])

    u1()
    u2()
  })

  test('default `at` argument uses Date.now()', () => {
    const dateNowMock = vi.spyOn(Date, 'now').mockReturnValue(12345)

    ledgerHealthBus.recordSuccess()
    expect(ledgerHealthBus.getSnapshot().lastSuccessAt).toBe(12345)

    ledgerHealthBus.recordFailure()
    expect(ledgerHealthBus.getSnapshot().lastFailureAt).toBe(12345)

    dateNowMock.mockRestore()
  })
})
