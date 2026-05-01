import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { OidcStateStore } from '../auth/state-store.js'

describe('OidcStateStore', () => {
  it('returns the orgId+nonce stored under a state value', () => {
    const store = new OidcStateStore()
    store.put('s1', { orgId: 'goldman', nonce: 'n1' })
    assert.deepEqual(store.consume('s1'), { orgId: 'goldman', nonce: 'n1' })
  })

  it('returns null for an unknown state', () => {
    const store = new OidcStateStore()
    assert.equal(store.consume('does-not-exist'), null)
  })

  it('is one-time-use: a second consume of the same state returns null', () => {
    const store = new OidcStateStore()
    store.put('s1', { orgId: 'goldman', nonce: 'n1' })
    store.consume('s1')
    assert.equal(store.consume('s1'), null)
  })

  it('returns null for an expired entry', async () => {
    const store = new OidcStateStore(0) // 0s TTL
    store.put('s1', { orgId: 'goldman', nonce: 'n1' })
    // Wait one tick so Date.now() advances past expiresAt.
    await new Promise((r) => setTimeout(r, 5))
    assert.equal(store.consume('s1'), null)
  })
})
