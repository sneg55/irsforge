/**
 * Short-lived store of fully-minted access tokens, keyed by an opaque
 * one-time handoff code.
 *
 * Used to bridge the IdP redirect → SPA without putting the JWT in the
 * URL. /auth/callback puts the JWT here under a UUID and redirects with
 * only `?handoff=<uuid>`; the SPA then POSTs that handoff to /auth/handoff
 * to receive the JWT in the response body. The entry is consumed (deleted)
 * on first read; entries past their TTL are dropped on access.
 *
 * Single-process only — multi-instance auth deployments must back this
 * with a shared store (Redis or similar).
 */

interface HandoffEntry {
  accessToken: string
  expiresIn: number // seconds, lifetime of the JWT itself
  userId: string
  orgId: string
  party: string
  expiresAt: number // ms epoch — when this handoff entry itself expires
}

export class HandoffStore {
  private readonly ttlMs: number
  private readonly store = new Map<string, HandoffEntry>()

  constructor(ttlSeconds = 30) {
    this.ttlMs = ttlSeconds * 1000
  }

  put(handoff: string, data: Omit<HandoffEntry, 'expiresAt'>): void {
    this.store.set(handoff, { ...data, expiresAt: Date.now() + this.ttlMs })
  }

  consume(handoff: string): Omit<HandoffEntry, 'expiresAt'> | null {
    const entry = this.store.get(handoff)
    if (!entry) return null
    this.store.delete(handoff)
    if (entry.expiresAt < Date.now()) return null
    const { expiresAt: _expiresAt, ...rest } = entry
    return rest
  }
}
