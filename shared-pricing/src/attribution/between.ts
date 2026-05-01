// shared-pricing/src/attribution/between.ts
import type { SwapConfig } from '../engine/types.js'
import {
  type AttributionBreakdown,
  decompose,
  type LedgerEvent,
  type PricingSnapshot,
} from './decompose.js'

/**
 * Decompose NPV change between two explicitly pinned snapshots from a
 * supplied history. Events outside (t0, t1] are filtered out before
 * delegating to `decompose`.
 *
 * Throws when either `t0` or `t1` does not match any snapshot's `asOf`
 * exactly — we require the caller to hand in the exact snapshots that
 * were seen, rather than interpolating or guessing.
 */
export function between(
  config: SwapConfig,
  snapshots: PricingSnapshot[],
  events: LedgerEvent[],
  t0: string,
  t1: string,
): AttributionBreakdown {
  const snap0 = snapshots.find((s) => s.asOf === t0)
  if (!snap0) throw new Error(`between: no snapshot at t0=${t0}`)
  const snap1 = snapshots.find((s) => s.asOf === t1)
  if (!snap1) throw new Error(`between: no snapshot at t1=${t1}`)
  const windowed = events.filter((e) => e.date > t0 && e.date <= t1)
  return decompose(config, snap0, snap1, windowed)
}
