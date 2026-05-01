'use client'

import { useLastTick } from './use-last-tick'

// Phase 6 Stage B — SchedulerStatusPill.
//
// Color rule: green when last tick is fresh (<75s), yellow when stale
// (75s–5min), red when down (>5min). Liveness is driven by
// MarkToMarket.asOf / NettedBatch.paymentTimestamp, and the CSA
// mark-settle cadence runs once per ~60s; 75s is one cycle + 15s
// jitter so the pill stays green between marks instead of flapping
// yellow every minute.
//
// Fresh-sandbox case: useLastTick returns null when no MarkToMarket or
// NettedBatch exists yet. Render a neutral "Starting up" state instead
// of computing age-from-epoch which otherwise shows ~29M minutes.
const FRESH_MS = 75_000
const STALE_MS = 300_000

function formatTickTooltip(lastTick: Date | null): string {
  if (lastTick === null) return 'Scheduler — no ticks observed yet'
  const ageSec = Math.max(0, Math.floor((Date.now() - lastTick.getTime()) / 1000))
  return `Last tick ${lastTick.toISOString()} (${ageSec}s ago) · cadence ~60s · fresh-window ${FRESH_MS / 1000}s`
}

export function SchedulerStatusPill() {
  const lastTick = useLastTick()
  const tooltip = formatTickTooltip(lastTick)

  if (lastTick === null) {
    return (
      <span className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-300" title={tooltip}>
        Starting up
      </span>
    )
  }

  const ageMs = Date.now() - lastTick.getTime()

  if (ageMs < FRESH_MS) {
    return (
      <span className="px-2 py-1 text-xs rounded bg-green-900 text-green-200" title={tooltip}>
        Scheduler OK
      </span>
    )
  }
  if (ageMs < STALE_MS) {
    const sec = Math.floor(ageMs / 1000)
    return (
      <span className="px-2 py-1 text-xs rounded bg-yellow-900 text-yellow-200" title={tooltip}>
        Stale ({sec}s)
      </span>
    )
  }
  const min = Math.floor(ageMs / 60_000)
  return (
    <span className="px-2 py-1 text-xs rounded bg-red-900 text-red-200" title={tooltip}>
      Down ({min}m)
    </span>
  )
}
