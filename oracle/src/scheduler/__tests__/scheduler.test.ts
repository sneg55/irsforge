import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../shared/logger'
import { resetState, state } from '../../shared/state'
import { Scheduler } from '../scheduler'

function makeLogger(): Logger & { _logs: unknown[] } {
  const logs: unknown[] = []
  return {
    info: (d) => logs.push({ level: 'info', ...d }),
    warn: (d) => logs.push({ level: 'warn', ...d }),
    error: (d) => logs.push({ level: 'error', ...d }),
    _logs: logs,
  }
}

describe('Scheduler', () => {
  beforeEach(() => resetState())

  it('tick() success path updates state.lastSuccessfulPublish and clears error', async () => {
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
      cron: '0 0 1 1 *',
      timezone: 'UTC',
      sofrService,
      ledgerPublisher: ledgerPublisher as never,
      state,
      logger: makeLogger(),
    })
    await (scheduler as unknown as { runOnce(): Promise<void> }).runOnce()
    expect(state.lastSuccessfulPublish).not.toBeNull()
    expect(state.lastSuccessfulPublish!.tenors).toBe(1)
    expect(state.lastSuccessfulPublish!.skipped).toBe(false)
    expect(state.lastPublishError).toBeNull()
  })

  it('tick() with publisher throwing populates lastPublishError and does NOT rethrow', async () => {
    const sofrService = {
      fetchAndBuildCurve: vi.fn().mockResolvedValue([]),
      fetchSingleRate: vi.fn(),
    }
    const ledgerPublisher = {
      publishCurve: vi.fn().mockRejectedValue(new Error('ledger down')),
      publishRate: vi.fn(),
      publishDiscountCurve: vi.fn().mockResolvedValue(undefined),
      publishProjectionCurve: vi.fn().mockResolvedValue(undefined),
    }
    const logger = makeLogger()
    const scheduler = new Scheduler({
      cron: '0 0 1 1 *',
      timezone: 'UTC',
      sofrService,
      ledgerPublisher: ledgerPublisher as never,
      state,
      logger,
      retry: { attempts: 1, baseMs: 1, jitter: 0 },
    })
    await expect(
      (scheduler as unknown as { runOnce(): Promise<void> }).runOnce(),
    ).resolves.toBeUndefined()
    expect(state.lastPublishError).not.toBeNull()
    expect(state.lastPublishError!.message).toContain('ledger down')
    expect(logger._logs.some((l) => (l as { event: string }).event === 'publish_failed')).toBe(true)
  })

  it('tick() skipped publish records skipped=true in lastSuccessfulPublish', async () => {
    const sofrService = {
      fetchAndBuildCurve: vi.fn().mockResolvedValue([]),
      fetchSingleRate: vi.fn(),
    }
    const ledgerPublisher = {
      publishCurve: vi.fn().mockResolvedValue({ skipped: true, count: 0 }),
      publishRate: vi.fn(),
      publishDiscountCurve: vi.fn().mockResolvedValue(undefined),
      publishProjectionCurve: vi.fn().mockResolvedValue(undefined),
    }
    const scheduler = new Scheduler({
      cron: '0 0 1 1 *',
      timezone: 'UTC',
      sofrService,
      ledgerPublisher: ledgerPublisher as never,
      state,
      logger: makeLogger(),
    })
    await (scheduler as unknown as { runOnce(): Promise<void> }).runOnce()
    expect(state.lastSuccessfulPublish!.skipped).toBe(true)
    expect(state.lastSuccessfulPublish!.tenors).toBe(0)
  })

  it('stop() awaits in-flight tick', async () => {
    let resolveTick: (() => void) | null = null
    const sofrService = {
      fetchAndBuildCurve: vi.fn().mockImplementation(
        () =>
          new Promise((r) => {
            resolveTick = () => r([])
          }),
      ),
      fetchSingleRate: vi.fn(),
    }
    const ledgerPublisher = {
      publishCurve: vi.fn().mockResolvedValue({ skipped: false, count: 0 }),
      publishRate: vi.fn(),
      publishDiscountCurve: vi.fn().mockResolvedValue(undefined),
      publishProjectionCurve: vi.fn().mockResolvedValue(undefined),
    }
    const scheduler = new Scheduler({
      cron: '0 0 1 1 *',
      timezone: 'UTC',
      sofrService,
      ledgerPublisher: ledgerPublisher as never,
      state,
      logger: makeLogger(),
    })
    const runPromise = (scheduler as unknown as { runOnce(): Promise<void> }).runOnce()
    // Mimic the tick() wiring so stop() awaits runPromise via inflight.
    ;(scheduler as unknown as { inflight: Promise<void> }).inflight = runPromise
    const stopPromise = scheduler.stop()
    let stopResolved = false
    stopPromise.then(() => {
      stopResolved = true
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(stopResolved).toBe(false)
    resolveTick!()
    await runPromise
    await stopPromise
    expect(stopResolved).toBe(true)
  })
})
