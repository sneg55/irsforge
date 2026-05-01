import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DemoResetBanner, formatCountdown, nextResetMs } from '../demo-reset-banner'

let mockDemoReset: { enabled: boolean; intervalMinutes: number; message?: string } | undefined
vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => ({
    config: { demoReset: mockDemoReset },
    loading: false,
    getOrg: () => undefined,
  }),
}))

describe('nextResetMs', () => {
  it('rounds up to the next interval boundary', () => {
    // 2026-01-01T12:34:56Z
    const now = Date.UTC(2026, 0, 1, 12, 34, 56)
    // Hourly: next boundary is 13:00:00 UTC
    expect(nextResetMs(now, 60)).toBe(Date.UTC(2026, 0, 1, 13, 0, 0))
    // 30-min: next boundary is 13:00:00 UTC (current half-hour 12:30 already passed)
    expect(nextResetMs(now, 30)).toBe(Date.UTC(2026, 0, 1, 13, 0, 0))
    // 15-min: next boundary is 12:45:00 UTC
    expect(nextResetMs(now, 15)).toBe(Date.UTC(2026, 0, 1, 12, 45, 0))
  })

  it('lands on the NEXT boundary when already on a boundary', () => {
    // exactly 12:00:00 UTC — must skip to 13:00, not stay
    const onTheHour = Date.UTC(2026, 0, 1, 12, 0, 0)
    expect(nextResetMs(onTheHour, 60)).toBe(Date.UTC(2026, 0, 1, 13, 0, 0))
  })
})

describe('formatCountdown', () => {
  it('formats sub-minute as seconds', () => {
    expect(formatCountdown(45_000)).toBe('45 sec')
    expect(formatCountdown(0)).toBe('0 sec')
    expect(formatCountdown(-100)).toBe('0 sec')
  })

  it('formats sub-hour as minutes', () => {
    expect(formatCountdown(60_000)).toBe('1 min')
    expect(formatCountdown(12 * 60_000 + 30_000)).toBe('12 min')
  })

  it('formats over an hour with hr+min', () => {
    expect(formatCountdown(60 * 60_000)).toBe('1 hr')
    expect(formatCountdown(72 * 60_000)).toBe('1 hr 12 min')
  })
})

describe('<DemoResetBanner />', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 12, 34, 56)))
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    mockDemoReset = undefined
  })

  it('renders nothing when demoReset is absent', () => {
    mockDemoReset = undefined
    const { container } = render(<DemoResetBanner />)
    // Mount effect runs immediately; nothing should be in the DOM.
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when demoReset.enabled is false', () => {
    mockDemoReset = { enabled: false, intervalMinutes: 60 }
    const { container } = render(<DemoResetBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders countdown when enabled', async () => {
    mockDemoReset = { enabled: true, intervalMinutes: 60 }
    const { container } = render(<DemoResetBanner />)
    // Tick the post-mount effect's setNowMs(Date.now()).
    await vi.advanceTimersByTimeAsync(0)
    const text = container.textContent ?? ''
    expect(text).toContain('13:00 UTC')
    expect(text).toContain('25 min')
  })

  it('honors a custom message override', async () => {
    mockDemoReset = {
      enabled: true,
      intervalMinutes: 60,
      message: 'Judges-only sandbox.',
    }
    const { container } = render(<DemoResetBanner />)
    await vi.advanceTimersByTimeAsync(0)
    expect(container.textContent).toContain('Judges-only sandbox.')
    expect(container.textContent).not.toContain('UTC')
  })
})
