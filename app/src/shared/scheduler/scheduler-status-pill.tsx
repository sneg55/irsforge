'use client'

import { useLedgerHealth } from '@/shared/hooks/use-ledger-health'
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
// Null-lastTick cases:
//   - health === 'live': polling is working but oracle hasn't published
//     any signal yet. Render "Awaiting first tick" — explicit about
//     what we're waiting on, and reads accurately on fresh tabs opened
//     just after a demo reset (where the previous "Starting up" copy
//     suggested the whole demo had restarted in front of the user).
//   - otherwise (idle/reconnecting/down): we either have no client yet
//     or the ledger isn't reachable; render "Starting up" so the pill
//     doesn't claim we're waiting on a tick when we can't even ask.
const FRESH_MS = 75_000
const STALE_MS = 300_000

function formatTickTooltip(lastTick: Date | null): string {
  if (lastTick === null) return 'Scheduler — no ticks observed yet'
  const ageSec = Math.max(0, Math.floor((Date.now() - lastTick.getTime()) / 1000))
  return `Last tick ${lastTick.toISOString()} (${ageSec}s ago) · cadence ~60s · fresh-window ${FRESH_MS / 1000}s`
}

export function SchedulerStatusPill() {
  const lastTick = useLastTick()
  const ledgerHealth = useLedgerHealth()
  const tooltip = formatTickTooltip(lastTick)

  if (lastTick === null) {
    const label = ledgerHealth === 'live' ? 'Awaiting first tick' : 'Starting up'
    return (
      <span className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-300" title={tooltip}>
        {label}
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
