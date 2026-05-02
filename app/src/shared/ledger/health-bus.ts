// Centralized signal for "is the Canton ledger reachable right now?".
//
// `LedgerClient.request` reports the outcome of every /api/ledger call to
// this bus, and `useLedgerHealth()` derives a three-state health label
// (idle | live | down) from the rolling outcome history. The only honest
// source for the
// status-bar dot and for page-level "ledger unreachable" empty states —
// the existence of a `client` instance does NOT imply a healthy ledger
// (the LedgerClient is a stateless wrapper around a JWT and a fetch
// helper; it would happily exist while every gRPC call to the participant
// returns UNAVAILABLE — observed during the JVM-OOM sandbox-dead-but-
// JSON-API-alive window on demo prod, fix shipped d1aa898).
//
// The bus keeps no per-call history (only counts and timestamps) so it is
// safe to leave running across the whole session — memory footprint is
// O(1) regardless of call volume.

export type LedgerHealthState = 'idle' | 'live' | 'down'

export interface LedgerHealthSnapshot {
  readonly lastSuccessAt: number | null
  readonly lastFailureAt: number | null
  readonly consecutiveFailures: number
}

const DOWN_THRESHOLD = 3

export function deriveHealth(snapshot: LedgerHealthSnapshot): LedgerHealthState {
  if (snapshot.lastSuccessAt === null && snapshot.lastFailureAt === null) return 'idle'
  if (snapshot.consecutiveFailures >= DOWN_THRESHOLD) return 'down'
  return 'live'
}

type Listener = (snapshot: LedgerHealthSnapshot) => void

class LedgerHealthBus {
  private snapshot: LedgerHealthSnapshot = {
    lastSuccessAt: null,
    lastFailureAt: null,
    consecutiveFailures: 0,
  }
  private readonly listeners = new Set<Listener>()

  recordSuccess(at: number = Date.now()): void {
    this.snapshot = {
      lastSuccessAt: at,
      lastFailureAt: this.snapshot.lastFailureAt,
      consecutiveFailures: 0,
    }
    this.notify()
  }

  recordFailure(at: number = Date.now()): void {
    this.snapshot = {
      lastSuccessAt: this.snapshot.lastSuccessAt,
      lastFailureAt: at,
      consecutiveFailures: this.snapshot.consecutiveFailures + 1,
    }
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
    this.snapshot = { lastSuccessAt: null, lastFailureAt: null, consecutiveFailures: 0 }
    this.notify()
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
