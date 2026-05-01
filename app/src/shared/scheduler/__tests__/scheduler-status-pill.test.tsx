import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SchedulerStatusPill } from '../scheduler-status-pill'

import { useLastTick } from '../use-last-tick'

vi.mock('../use-last-tick', () => ({
  useLastTick: vi.fn(),
}))

const mocked = vi.mocked(useLastTick)

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

  it('renders neutral "Starting up" on a fresh sandbox (lastTick=null)', () => {
    mocked.mockReturnValue(null)
    render(<SchedulerStatusPill />)
    const pill = screen.getByText(/Starting up/)
    expect(pill.className).toMatch(/zinc/)
  })
})
