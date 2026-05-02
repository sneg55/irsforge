// Centralized signal for "is the Canton ledger reachable right now?".
//
// `LedgerClient.request` reports the outcome of every /api/ledger call to
// this bus, and `useLedgerHealth()` derives a four-state health label
// (idle | live | reconnecting | down) from the rolling outcome history.
// The only honest source for the status-bar dot and for page-level "ledger
// unreachable" empty states — the existence of a `client` instance does
// NOT imply a healthy ledger (the LedgerClient is a stateless wrapper
// around a JWT and a fetch helper; it would happily exist while every
// gRPC call to the participant returns UNAVAILABLE — observed during the
// JVM-OOM sandbox-dead-but-JSON-API-alive window on demo prod, fix
// shipped d1aa898).
//
// 'reconnecting' bridges the gap between "we just crossed back from down
// to live" and "data has actually flowed in". Without it, a recovering
// tab snapped from 'down' to 'live' the moment the first poll succeeded
// — but a successful poll with an empty result body (Canton reachable,
// reseed in progress) is indistinguishable from "you have no swaps", so
// pages dropped their LedgerUnreachable banner and showed an empty table.
// The reconnecting window is sticky for `RECONNECTING_WINDOW_MS` after
// the recovery transition; downstream pages keep their last cached
// snapshot OR a friendlier banner during that grace period.
//
// The bus keeps no per-call history (only counts and timestamps) so it is
// safe to leave running across the whole session — memory footprint is
// O(1) regardless of call volume.

export type LedgerHealthState = 'idle' | 'live' | 'reconnecting' | 'down'

export interface LedgerHealthSnapshot {
  readonly lastSuccessAt: number | null
  readonly lastFailureAt: number | null
  readonly consecutiveFailures: number
  // Epoch ms when the current reconnecting window closes. Null when we
  // are not in or just-exiting the reconnecting state. Set on a
  // down→live transition; cleared by a fresh failure or by the
  // bus-scheduled timer that fires when the window elapses.
  readonly reconnectingUntil: number | null
}

const DOWN_THRESHOLD = 3
const RECONNECTING_WINDOW_MS = 10_000

export function deriveHealth(
  snapshot: LedgerHealthSnapshot,
  now: number = Date.now(),
): LedgerHealthState {
  if (snapshot.lastSuccessAt === null && snapshot.lastFailureAt === null) return 'idle'
  if (snapshot.consecutiveFailures >= DOWN_THRESHOLD) return 'down'
  if (snapshot.reconnectingUntil !== null && now < snapshot.reconnectingUntil) {
    return 'reconnecting'
  }
  return 'live'
}

type Listener = (snapshot: LedgerHealthSnapshot) => void

class LedgerHealthBus {
  private snapshot: LedgerHealthSnapshot = {
    lastSuccessAt: null,
    lastFailureAt: null,
    consecutiveFailures: 0,
    reconnectingUntil: null,
  }
  private readonly listeners = new Set<Listener>()
  // Fires when the reconnecting window elapses; we re-notify so
  // consumers using `useSyncExternalStore` re-render and see 'live'
  // again. Cleared on every snapshot update so a fresh failure or a
  // re-entry into reconnecting cancels the prior expiry.
  private reconnectingTimer: ReturnType<typeof setTimeout> | null = null

  recordSuccess(at: number = Date.now()): void {
    // Promote into reconnecting iff we were `down` (consecutiveFailures
    // crossed the threshold) right before this success — that's the
    // 'down→live' edge that benefits from a recovery grace period.
    // Single-blip recoveries (1 or 2 failures) skip straight to live;
    // they never visibly degraded the UI.
    //
    // If we are ALREADY inside an open reconnecting window from a
    // prior success, preserve it — multiple successes during the
    // grace period must not clobber the still-running timer.
    const wasDown = this.snapshot.consecutiveFailures >= DOWN_THRESHOLD
    const reconnectingUntil = wasDown
      ? at + RECONNECTING_WINDOW_MS
      : this.snapshot.reconnectingUntil
    this.snapshot = {
      lastSuccessAt: at,
      lastFailureAt: this.snapshot.lastFailureAt,
      consecutiveFailures: 0,
      reconnectingUntil,
    }
    if (wasDown) {
      this.scheduleReconnectingExpiry(reconnectingUntil)
    }
    this.notify()
  }

  recordFailure(at: number = Date.now()): void {
    this.snapshot = {
      lastSuccessAt: this.snapshot.lastSuccessAt,
      lastFailureAt: at,
      consecutiveFailures: this.snapshot.consecutiveFailures + 1,
      reconnectingUntil: null,
    }
    this.scheduleReconnectingExpiry(null)
    this.notify()
  }

  getSnapshot(): LedgerHealthSnapshot {
    return this.snapshot
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // Test-only: clear state between specs so consecutiveFailures from one
  // test doesn't bleed into the next.
  resetForTesting(): void {
    this.snapshot = {
      lastSuccessAt: null,
      lastFailureAt: null,
      consecutiveFailures: 0,
      reconnectingUntil: null,
    }
    this.scheduleReconnectingExpiry(null)
    this.notify()
  }

  private scheduleReconnectingExpiry(until: number | null): void {
    if (this.reconnectingTimer !== null) {
      clearTimeout(this.reconnectingTimer)
      this.reconnectingTimer = null
    }
    if (until === null) return
    const delay = Math.max(0, until - Date.now())
    this.reconnectingTimer = setTimeout(() => {
      this.reconnectingTimer = null
      // Only clear the field if it still matches what we scheduled — a
      // fresh failure (and its own scheduleReconnectingExpiry(null))
      // would have nulled it already; we don't want to clobber
      // unrelated state.
      if (this.snapshot.reconnectingUntil === until) {
        this.snapshot = { ...this.snapshot, reconnectingUntil: null }
        this.notify()
      }
    }, delay)
  }

  private notify(): void {
    const snapshot = this.snapshot
    const subscribers = Array.from(this.listeners)
    for (const l of subscribers) {
      try {
        l(snapshot)
      } catch {
        // silent-ok — health is best-effort signal, one bad subscriber must not block others
      }
    }
  }
}

export const ledgerHealthBus = new LedgerHealthBus()
