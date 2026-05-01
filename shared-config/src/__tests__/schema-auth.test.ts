import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { authSchema } from '../schema.js'

const BUILTIN = {
  issuer: 'http://localhost:3002',
  keyAlgorithm: 'RS256',
  tokenTtlSeconds: 900,
  refreshTtlSeconds: 86400,
  port: 3002,
}

const OIDC = {
  authority: 'https://auth.example.com',
  clientId: 'my-client',
  clientSecret: 'my-secret',
}

describe('authSchema provider/sub-block enforcement', () => {
  it('accepts provider=demo with no sub-blocks', () => {
    const r = authSchema.safeParse({ provider: 'demo' })
    assert.equal(r.success, true)
  })

  it('accepts provider=builtin with builtin block', () => {
    const r = authSchema.safeParse({ provider: 'builtin', builtin: BUILTIN })
    assert.equal(r.success, true)
  })

  it('accepts provider=oidc with both builtin and oidc blocks', () => {
    const r = authSchema.safeParse({ provider: 'oidc', builtin: BUILTIN, oidc: OIDC })
    assert.equal(r.success, true)
  })

  it('rejects provider=builtin without builtin block', () => {
    const r = authSchema.safeParse({ provider: 'builtin' })
    assert.equal(r.success, false)
    if (!r.success) {
      assert.ok(
        r.error.issues.some((i) => i.path.includes('builtin')),
        'expected issue on path ["builtin"]',
      )
    }
  })

  it('rejects provider=oidc without oidc block (even with builtin present)', () => {
    const r = authSchema.safeParse({ provider: 'oidc', builtin: BUILTIN })
    assert.equal(r.success, false)
    if (!r.success) {
      assert.ok(
        r.error.issues.some((i) => i.path.includes('oidc')),
        'expected issue on path ["oidc"]',
      )
    }
  })

  it('rejects provider=oidc without builtin block (needed to mint ledger JWTs)', () => {
    const r = authSchema.safeParse({ provider: 'oidc', oidc: OIDC })
    assert.equal(r.success, false)
    if (!r.success) {
      assert.ok(
        r.error.issues.some((i) => i.path.includes('builtin')),
        'expected issue on path ["builtin"]',
      )
    }
  })
})
