// Detection bus for "the participant under us got reallocated" — a Canton
// in-memory sandbox restart (the demo's hourly reset cycle is the
// canonical example) reallocates qualified party IDs, so a JWT minted
// against the prior boot's fingerprints continues to verify but
// `actAs` references parties that no longer exist. Canton's JSON API
// silently returns `{result:[]}` for those queries — `ledgerHealthBus`
// reads that as `live`, the StatusBar dot stays green, and the user
// sees an empty blotter while the seeded data is right there on the
// fresh ledger.
//
// Two signals feed this bus:
//   1. Canary template count drops from non-zero to zero. Caller
//      (LedgerClient.pingCanary) picks a template that the seed
//      always populates and never archives — empty implies "we are
//      asking a participant that doesn't know about our parties".
//   2. ledgerHealthBus crosses the down→live edge. A clean reset
//      typically takes 60–90 s, long enough for the consecutive-
//      failure threshold (3) to be crossed, so this catches the case
//      where the canary hasn't been polled yet during the recovery.
//
// Both signals collapse to a single rotation event. A 30 s cooldown
// keeps the handler from re-running on every canary tick that arrives
// before the freshly-minted JWT has propagated.
//
// Detection is intentionally suspicious-of-self: a single canary tick
// returning empty is enough. The dedup window means a false positive
// costs us one silent remint cycle — cheaper than missing the actual
// rotation and leaving the user staring at an empty UI until F5.

export type SandboxRotationReason = 'canary-empty' | 'health-reconnect'

export interface SandboxRotationEvent {
  readonly reason: SandboxRotationReason
  readonly at: number
}

const COOLDOWN_MS = 30_000

type Listener = (event: SandboxRotationEvent) => void

class SandboxRotationBus {
  // Per-template "last non-zero count we saw". Reset on rotation fire so
  // a freshly recovered ledger doesn't immediately re-fire if its first
  // canary tick lands while still empty (rare race; the 30 s cooldown
  // covers the common path but the reset closes the corner).
  private readonly canaryBaseline = new Map<string, number>()
  private cooldownUntil = 0
  private readonly listeners = new Set<Listener>()
  private now: () => number = Date.now

  // Test seam — keep behaviour deterministic without hijacking the global
  // Date.now / fake-timers dance for every spec.
  setClockForTesting(now: () => number): void {
    this.now = now
  }

  recordCanaryCount(templateId: string, count: number): void {
    if (count > 0) {
      this.canaryBaseline.set(templateId, count)
      return
    }
    // count === 0
    const baseline = this.canaryBaseline.get(templateId) ?? 0
    if (baseline === 0) return // never observed populated, can't tell yet
    this.fire('canary-empty')
  }

  recordHealthReconnect(): void {
    this.fire('health-reconnect')
  }

  // Test seam — clear baseline state between specs without leaking module-
  // scope mutation across tests.
  resetForTesting(): void {
    this.canaryBaseline.clear()
    this.cooldownUntil = 0
    this.listeners.clear()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private fire(reason: SandboxRotationReason): void {
    const at = this.now()
    if (at < this.cooldownUntil) return
    this.cooldownUntil = at + COOLDOWN_MS
    // Clear baselines so the post-rotation refetch builds fresh evidence
    // before we'd ever fire again. Without this, a canary that returns
    // 0 during the recovery window could re-trigger immediately after
    // the 30 s cooldown expires.
    this.canaryBaseline.clear()
    const event: SandboxRotationEvent = { reason, at }
    for (const l of Array.from(this.listeners)) {
      try {
        l(event)
      } catch {
        // silent-ok — one bad subscriber must not gate the others
      }
    }
  }
}

export const sandboxRotationBus = new SandboxRotationBus()
