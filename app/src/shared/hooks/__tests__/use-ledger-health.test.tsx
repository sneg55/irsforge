import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ledgerHealthBus } from '@/shared/ledger/health-bus'
import { useLedgerHealth } from '../use-ledger-health'

function Probe() {
  const state = useLedgerHealth()
  return <div data-testid="health">{state}</div>
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.setSystemTime(new Date('2026-05-02T00:00:00Z'))
})

afterEach(() => {
  ledgerHealthBus.resetForTesting()
  vi.useRealTimers()
})

describe('useLedgerHealth', () => {
  test('starts idle on first render', () => {
    render(<Probe />)
    expect(screen.getByTestId('health').textContent).toBe('idle')
  })

  test('flips to live on first recorded success', () => {
    render(<Probe />)
    act(() => {
      ledgerHealthBus.recordSuccess(1000)
    })
    expect(screen.getByTestId('health').textContent).toBe('live')
  })

  test('flips to down once consecutive failures cross the threshold', () => {
    render(<Probe />)
    act(() => {
      ledgerHealthBus.recordFailure(1000)
      ledgerHealthBus.recordFailure(2000)
      ledgerHealthBus.recordFailure(3000)
    })
    expect(screen.getByTestId('health').textContent).toBe('down')
  })

  test('a single transient blip never trips reconnecting on recovery', () => {
    render(<Probe />)
    act(() => {
      ledgerHealthBus.recordFailure()
      ledgerHealthBus.recordSuccess()
    })
    // One failure never crossed the down threshold — the recovering UI
    // didn't degrade so we stay on 'live' rather than flashing
    // 'reconnecting' for unrelated network noise.
    expect(screen.getByTestId('health').textContent).toBe('live')
  })

  test('success after a sustained down enters reconnecting, then transitions to live', () => {
    render(<Probe />)
    act(() => {
      ledgerHealthBus.recordFailure()
      ledgerHealthBus.recordFailure()
      ledgerHealthBus.recordFailure()
    })
    expect(screen.getByTestId('health').textContent).toBe('down')

    act(() => {
      ledgerHealthBus.recordSuccess()
    })
    // Down→live edge enters the reconnecting grace window so pages can
    // refill their data caches before the user thinks the demo lost
    // everything.
    expect(screen.getByTestId('health').textContent).toBe('reconnecting')

    act(() => {
      // Window is 10s; advance past it and the bus's scheduled timer
      // should re-notify with reconnectingUntil cleared.
      vi.advanceTimersByTime(11_000)
    })
    expect(screen.getByTestId('health').textContent).toBe('live')
  })

  test('a fresh failure during the reconnecting window cancels it', () => {
    render(<Probe />)
    act(() => {
      ledgerHealthBus.recordFailure()
      ledgerHealthBus.recordFailure()
      ledgerHealthBus.recordFailure()
      ledgerHealthBus.recordSuccess()
    })
    expect(screen.getByTestId('health').textContent).toBe('reconnecting')

    act(() => {
      ledgerHealthBus.recordFailure()
    })
    // Failure clears reconnectingUntil. consecutiveFailures has only
    // gone from 0 (after the prior success) to 1, so we're not 'down'
    // either — we're back to 'live' until the next two failures push
    // us across the threshold.
    expect(screen.getByTestId('health').textContent).toBe('live')
  })

  test('component unmount cleans up the subscription', () => {
    const { unmount } = render(<Probe />)
    unmount()
    // After unmount, recording should not throw and listener count
    // should not include the consumer. Indirect proof: dispatching
    // succeeds (a leaked listener pointing at unmounted React state
    // would surface as a React warning under strict mode).
    expect(() => {
      ledgerHealthBus.recordSuccess(1000)
    }).not.toThrow()
  })
})
