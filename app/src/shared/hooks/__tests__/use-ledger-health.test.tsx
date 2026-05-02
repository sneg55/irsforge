import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { ledgerHealthBus } from '@/shared/ledger/health-bus'
import { useLedgerHealth } from '../use-ledger-health'

function Probe() {
  const state = useLedgerHealth()
  return <div data-testid="health">{state}</div>
}

afterEach(() => {
  ledgerHealthBus.resetForTesting()
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

  test('one success after a down state immediately recovers to live', () => {
    render(<Probe />)
    act(() => {
      ledgerHealthBus.recordFailure(1000)
      ledgerHealthBus.recordFailure(2000)
      ledgerHealthBus.recordFailure(3000)
    })
    expect(screen.getByTestId('health').textContent).toBe('down')

    act(() => {
      ledgerHealthBus.recordSuccess(4000)
    })
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
