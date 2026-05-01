import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HandoffStore } from '../auth/handoff-store.js'

const SAMPLE = {
  accessToken: 'jwt.payload.sig',
  expiresIn: 900,
  userId: 'alice@example.com::goldman',
  orgId: 'goldman',
  party: 'PartyA::abc',
} as const

describe('HandoffStore', () => {
  it('returns the stored entry on first consume', () => {
    const store = new HandoffStore()
    store.put('h1', { ...SAMPLE })
    assert.deepEqual(store.consume('h1'), { ...SAMPLE })
  })

  it('returns null for an unknown handoff', () => {
    const store = new HandoffStore()
    assert.equal(store.consume('nope'), null)
  })

  it('is one-time-use: a second consume of the same handoff returns null', () => {
    const store = new HandoffStore()
    store.put('h1', { ...SAMPLE })
    store.consume('h1')
    assert.equal(store.consume('h1'), null)
  })

  it('returns null for an expired entry', async () => {
    const store = new HandoffStore(0) // 0s TTL
    store.put('h1', { ...SAMPLE })
    await new Promise((r) => setTimeout(r, 5))
    assert.equal(store.consume('h1'), null)
  })
})
