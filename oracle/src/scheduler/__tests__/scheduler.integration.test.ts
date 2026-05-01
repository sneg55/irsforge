import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../shared/logger'
import { resetState, state } from '../../shared/state'
import { Scheduler } from '../scheduler'

function silentLogger(): Logger {
  return { info: () => {}, warn: () => {}, error: () => {} }
}

describe('Scheduler integration', () => {
  beforeEach(() => resetState())

  it('runs a tick via real croner every second and updates state', async () => {
    const sofrService = {
      fetchAndBuildCurve: vi
        .fn()
        .mockResolvedValue([{ rateId: 'SOFR/ON', tenorDays: 1, rate: 0.05 }]),
      fetchSingleRate: vi.fn(),
    }
    const ledgerPublisher = {
      publishCurve: vi.fn().mockResolvedValue({ skipped: false, count: 1 }),
      publishRate: vi.fn(),
      publishDiscountCurve: vi.fn().mockResolvedValue(undefined),
      publishProjectionCurve: vi.fn().mockResolvedValue(undefined),
    }
    const scheduler = new Scheduler({
      cron: '* * * * * *', // every second (6-field format)
      timezone: 'UTC',
      sofrService,
      ledgerPublisher: ledgerPublisher as never,
      state,
      logger: silentLogger(),
      retry: { attempts: 1, baseMs: 1, jitter: 0 },
    })
    scheduler.start()
    for (let i = 0; i < 30; i++) {
      if (state.lastSuccessfulPublish) break
      await new Promise((r) => setTimeout(r, 100))
    }
    await scheduler.stop()
    expect(state.lastSuccessfulPublish).not.toBeNull()
    expect(sofrService.fetchAndBuildCurve).toHaveBeenCalled()
    expect(ledgerPublisher.publishCurve).toHaveBeenCalled()
  }, 10000)

  it('keeps running when a tick fails and recovers on the next tick', async () => {
    const sofrService = {
      fetchAndBuildCurve: vi.fn().mockResolvedValue([]),
      fetchSingleRate: vi.fn(),
    }
    const publishCurve = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ skipped: false, count: 0 })
    const ledgerPublisher = {
      publishCurve,
      publishRate: vi.fn(),
      publishDiscountCurve: vi.fn().mockResolvedValue(undefined),
      publishProjectionCurve: vi.fn().mockResolvedValue(undefined),
    }
    const scheduler = new Scheduler({
      cron: '* * * * * *',
      timezone: 'UTC',
      sofrService,
      ledgerPublisher: ledgerPublisher as never,
      state,
      logger: silentLogger(),
      retry: { attempts: 1, baseMs: 1, jitter: 0 },
    })
    scheduler.start()
    for (let i = 0; i < 30; i++) {
      if (state.lastPublishError) break
      await new Promise((r) => setTimeout(r, 100))
    }
    expect(state.lastPublishError).not.toBeNull()
    for (let i = 0; i < 30; i++) {
      if (state.lastSuccessfulPublish) break
      await new Promise((r) => setTimeout(r, 100))
    }
    await scheduler.stop()
    expect(state.lastSuccessfulPublish).not.toBeNull()
  }, 10000)
})
