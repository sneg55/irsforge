// Coalesce + serialise tick triggers from multiple sources (cron + push).
//
// Both the existing cron and the new SwapWorkflow stream watcher want to
// kick the mark publisher. Without coordination two kicks could run
// concurrently (causing duplicate publish work) or pile up during a slow
// tick (causing a stampede). This wrapper enforces:
//   1. At most one tick in flight at a time (mutex).
//   2. Triggers within `debounceMs` of each other collapse into one run.
//   3. A trigger arriving while a tick is running schedules exactly one
//      follow-up tick once the current one finishes — never more.

export interface CoalescedTickOpts {
  /**
   * Collapse triggers arriving within this window into a single tick.
   * Keeps a burst of swap accepts (e.g. demo seed) from spawning N ticks.
   */
  debounceMs: number
}

export interface CoalescedTick {
  /** Schedule a tick. No-op + queue if one is already in flight. */
  trigger: () => void
  /** True while a tick is actually executing (not just debouncing). */
  isRunning: () => boolean
  /** Cancel any pending debounced fire. The in-flight tick (if any) still completes. */
  stop: () => void
}

export function makeCoalescedTick(
  tick: () => Promise<unknown>,
  opts: CoalescedTickOpts,
): CoalescedTick {
  let running = false
  let queued = false
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const runOnce = async () => {
    running = true
    try {
      await tick()
    } finally {
      running = false
      if (queued && !stopped) {
        queued = false
        trigger()
      }
    }
  }

  const trigger = () => {
    if (stopped) return
    if (running) {
      // Defer to a follow-up tick after the current one completes.
      queued = true
      return
    }
    if (pendingTimer) clearTimeout(pendingTimer)
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      // Swallow errors here — the tick fn is the only place with the
      // context to log/route them (the publisher's tick already does so).
      // Letting a rejection escape would surface as an unhandledRejection
      // and pollute server logs without adding signal.
      runOnce().catch(() => {})
    }, opts.debounceMs)
  }

  const stop = () => {
    stopped = true
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
  }

  return { trigger, isRunning: () => running, stop }
}
