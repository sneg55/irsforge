'use client'

import { useEffect, useState } from 'react'
import { useConfig } from '../contexts/config-context'

// Computes the next round-clock reset boundary in epoch-ms. Reset cadence
// is `intervalMinutes` aligned to the unix epoch — at intervalMinutes=60
// that's the top of every hour UTC; at 30 it's :00 and :30. The host cron
// is the source of truth for the actual reset; this calculation only
// drives the banner countdown. Exported for unit testing.
export function nextResetMs(nowMs: number, intervalMinutes: number): number {
  const intervalMs = intervalMinutes * 60_000
  return Math.floor(nowMs / intervalMs + 1) * intervalMs
}

// Formats milliseconds to a short human label: "12 min", "47 sec", "1 hr 12 min".
// Returns "0 sec" for non-positive deltas — caller decides whether to render.
export function formatCountdown(deltaMs: number): string {
  if (deltaMs <= 0) return '0 sec'
  const totalSec = Math.floor(deltaMs / 1000)
  if (totalSec < 60) return `${totalSec} sec`
  const totalMin = Math.floor(totalSec / 60)
  if (totalMin < 60) return `${totalMin} min`
  const hr = Math.floor(totalMin / 60)
  const min = totalMin % 60
  return min === 0 ? `${hr} hr` : `${hr} hr ${min} min`
}

function formatUtcClock(epochMs: number): string {
  const d = new Date(epochMs)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm} UTC`
}

export function DemoResetBanner() {
  const { config } = useConfig()
  const [nowMs, setNowMs] = useState<number | null>(null)

  // Render nothing on the server / first paint — avoids hydration mismatch
  // when SSR's clock differs from the client's. After mount we tick at 1Hz.
  useEffect(() => {
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const reset = config?.demoReset
  if (!reset?.enabled || nowMs === null) return null

  const targetMs = nextResetMs(nowMs, reset.intervalMinutes)
  const remaining = formatCountdown(targetMs - nowMs)
  const clock = formatUtcClock(targetMs)
  const label =
    reset.message ?? `Shared demo: resets at ${clock} (${remaining}). Your changes will be wiped.`

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-700/40 bg-amber-900/30 px-4 py-1.5 text-center text-xs font-medium text-amber-200 backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">⟳</span>
      <span>{label}</span>
    </div>
  )
}
