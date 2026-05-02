import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLedgerHealth } from '@/shared/hooks/use-ledger-health'
import { SchedulerStatusPill } from '../scheduler-status-pill'

import { useLastTick } from '../use-last-tick'

vi.mock('../use-last-tick', () => ({
  useLastTick: vi.fn(),
}))

vi.mock('@/shared/hooks/use-ledger-health', () => ({
  useLedgerHealth: vi.fn(),
}))

const mocked = vi.mocked(useLastTick)
const mockedHealth = vi.mocked(useLedgerHealth)

afterEach(() => {
  mocked.mockReset()
  mockedHealth.mockReset()
})

describe('SchedulerStatusPill', () => {
  it('renders green when last tick is fresh (<75s)', () => {
    mocked.mockReturnValue(new Date(Date.now() - 5_000))
    render(<SchedulerStatusPill />)
    const pill = screen.getByText(/Scheduler OK/)
    expect(pill.className).toMatch(/green/)
  })

  it('renders yellow with seconds suffix when stale (75s–5min)', () => {
    mocked.mockReturnValue(new Date(Date.now() - 120_000))
    render(<SchedulerStatusPill />)
    const pill = screen.getByText(/Stale \(\d+s\)/)
    expect(pill.className).toMatch(/yellow/)
  })

  it('renders red with minutes suffix when down (>5min)', () => {
    mocked.mockReturnValue(new Date(Date.now() - 600_000))
    render(<SchedulerStatusPill />)
    const pill = screen.getByText(/Down \(\d+m\)/)
    expect(pill.className).toMatch(/red/)
  })

  it('renders "Starting up" when lastTick is null and ledger is idle/down', () => {
    mocked.mockReturnValue(null)
    mockedHealth.mockReturnValue('idle')
    render(<SchedulerStatusPill />)
    const pill = screen.getByText(/Starting up/)
    expect(pill.className).toMatch(/zinc/)
  })

  it('renders "Awaiting first tick" when ledger is live but no tick observed yet', () => {
    // Common post-reset window: Canton + Next.js are reachable again
    // (health === 'live') but oracle hasn't republished, so polling
    // returns no Curve/Mark/Batch yet. The clearer copy keeps users
    // from thinking the demo just restarted under them.
    mocked.mockReturnValue(null)
    mockedHealth.mockReturnValue('live')
    render(<SchedulerStatusPill />)
    expect(screen.getByText(/Awaiting first tick/)).toBeTruthy()
  })

  it('renders "Starting up" during reconnecting state when no tick observed', () => {
    // We hide the "Awaiting first tick" copy during reconnecting
    // because the dot already conveys an in-progress recovery; piling
    // a second optimistic message on top reads noisy.
    mocked.mockReturnValue(null)
    mockedHealth.mockReturnValue('reconnecting')
    render(<SchedulerStatusPill />)
    expect(screen.getByText(/Starting up/)).toBeTruthy()
  })
})
