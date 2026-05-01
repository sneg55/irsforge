import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { RefreshTokenStore } from '../tokens/refresh.js'

describe('RefreshTokenStore', () => {
  test('creates and validates a refresh token', () => {
    const store = new RefreshTokenStore(60)
    const token = store.create('user-1', 'org-1', ['Party::1'], ['Party::1'])

    assert.ok(typeof token === 'string' && token.length > 0, 'token should be a non-empty string')

    const result = store.validate(token)
    assert.ok(result !== null, 'token should be valid')
    assert.equal(result.userId, 'user-1', 'userId should match')
    assert.equal(result.orgId, 'org-1', 'orgId should match')
  })

  test('validates returns null for unknown token', () => {
    const store = new RefreshTokenStore(60)
    const result = store.validate('not-a-real-token')
    assert.equal(result, null, 'unknown token should return null')
  })

  test('rotates a token — old becomes invalid, new is valid', () => {
    const store = new RefreshTokenStore(60)
    const old = store.create('user-2', 'org-2', ['Party::2'], ['Party::2'])

    const next = store.rotate(old)
    assert.ok(next !== null, 'rotate should return a new token')
    assert.notEqual(next, old, 'new token should differ from old token')

    const oldResult = store.validate(old)
    assert.equal(oldResult, null, 'old token should be invalid after rotation')

    const newResult = store.validate(next)
    assert.ok(newResult !== null, 'new token should be valid')
    assert.equal(newResult.userId, 'user-2', 'userId should carry over')
    assert.equal(newResult.orgId, 'org-2', 'orgId should carry over')
  })

  test('rotate returns null for unknown token', () => {
    const store = new RefreshTokenStore(60)
    const result = store.rotate('bogus-token')
    assert.equal(result, null, 'rotating unknown token should return null')
  })

  test('revoke invalidates a token', () => {
    const store = new RefreshTokenStore(60)
    const token = store.create('user-3', 'org-3', ['Party::3'], ['Party::3'])

    store.revoke(token)
    const result = store.validate(token)
    assert.equal(result, null, 'revoked token should return null')
  })

  test('revoke on unknown token is a no-op', () => {
    const store = new RefreshTokenStore(60)
    assert.doesNotThrow(
      () => store.revoke('unknown-token'),
      'revoking unknown token should not throw',
    )
  })

  test('rotate preserves multi-party actAs/readAs', () => {
    const store = new RefreshTokenStore(60)
    const actAs = ['Alice::xyz', 'Bob::xyz']
    const readAs = ['Alice::xyz', 'Bob::xyz', 'Reg::xyz']

    const t1 = store.create('alice@example.com', 'goldman', actAs, readAs)
    const t2 = store.rotate(t1)
    assert.ok(t2 !== null, 'rotate returned null')

    const session = store.validate(t2)
    assert.ok(session !== null, 'validate returned null')
    assert.deepEqual(session.actAs, actAs)
    assert.deepEqual(session.readAs, readAs)
  })

  test('validate exposes actAs/readAs', () => {
    const store = new RefreshTokenStore(60)
    const t = store.create('alice@example.com', 'goldman', ['A::1'], ['A::1', 'R::1'])
    const s = store.validate(t)
    assert.deepEqual(s, {
      userId: 'alice@example.com',
      orgId: 'goldman',
      actAs: ['A::1'],
      readAs: ['A::1', 'R::1'],
    })
  })

  test('expired token returns null (ttl=0)', async () => {
    const store = new RefreshTokenStore(0)
    const token = store.create('user-4', 'org-4', ['Party::4'], ['Party::4'])

    // Give the token a moment to expire (ttl=0 means it's already expired)
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = store.validate(token)
    assert.equal(result, null, 'expired token should return null')
  })
})
