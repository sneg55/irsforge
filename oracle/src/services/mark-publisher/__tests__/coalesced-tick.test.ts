import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeCoalescedTick } from '../coalesced-tick.js'

describe('makeCoalescedTick', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces multiple triggers within the debounce window into one tick', async () => {
    const tick = vi.fn(async () => {})
    const c = makeCoalescedTick(tick, { debounceMs: 100 })
    c.trigger()
    c.trigger()
    c.trigger()
    expect(tick).toHaveBeenCalledTimes(0)
    await vi.advanceTimersByTimeAsync(100)
    expect(tick).toHaveBeenCalledTimes(1)
  })

  it('queues exactly one follow-up tick when triggered during an in-flight run', async () => {
    let resolveTick!: () => void
    const tickPromise = new Promise<void>((r) => {
      resolveTick = r
    })
    const tick = vi.fn(async () => {
      await tickPromise
    })
    const c = makeCoalescedTick(tick, { debounceMs: 50 })
    // First fire to start a tick.
    c.trigger()
    await vi.advanceTimersByTimeAsync(50)
    expect(tick).toHaveBeenCalledTimes(1)
    expect(c.isRunning()).toBe(true)
    // Triggers arriving while running should fold into ONE follow-up.
    c.trigger()
    c.trigger()
    c.trigger()
    expect(tick).toHaveBeenCalledTimes(1)
    // First tick completes; one queued follow-up should debounce-fire.
    resolveTick()
    await vi.runAllTimersAsync()
    expect(tick).toHaveBeenCalledTimes(2)
  })

  it('stop() cancels a pending debounce', async () => {
    const tick = vi.fn(async () => {})
    const c = makeCoalescedTick(tick, { debounceMs: 100 })
    c.trigger()
    c.stop()
    await vi.advanceTimersByTimeAsync(500)
    expect(tick).toHaveBeenCalledTimes(0)
  })

  it('isRunning() flips false even when tick throws', async () => {
    const tick = vi.fn(async () => {
      throw new Error('boom')
    })
    const c = makeCoalescedTick(tick, { debounceMs: 0 })
    c.trigger()
    await vi.runAllTimersAsync()
    expect(tick).toHaveBeenCalledTimes(1)
    expect(c.isRunning()).toBe(false)
  })
})
