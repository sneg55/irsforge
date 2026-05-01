/**
 * In-memory, single-process store of pending OIDC authorization requests.
 *
 * Each entry binds an opaque `state` (CSRF nonce shipped to the IdP and
 * echoed back in the callback URL) to the `orgId` that initiated the flow
 * and the OIDC `nonce` that we expect to find in the returned id_token.
 *
 * Entries are one-time-use: `consume` deletes on read. Expired entries are
 * dropped on access. This is sufficient for a single auth process; a
 * multi-instance deployment must back this with a shared store (e.g. Redis).
 */

interface StateEntry {
  orgId: string
  nonce: string
  expiresAt: number // ms epoch
}

export class OidcStateStore {
  private readonly ttlMs: number
  private readonly store = new Map<string, StateEntry>()

  constructor(ttlSeconds = 600) {
    this.ttlMs = ttlSeconds * 1000
  }

  put(state: string, data: { orgId: string; nonce: string }): void {
    this.store.set(state, {
      orgId: data.orgId,
      nonce: data.nonce,
      expiresAt: Date.now() + this.ttlMs,
    })
  }

  consume(state: string): { orgId: string; nonce: string } | null {
    const entry = this.store.get(state)
    if (!entry) return null
    this.store.delete(state)
    if (entry.expiresAt < Date.now()) return null
    return { orgId: entry.orgId, nonce: entry.nonce }
  }
}
