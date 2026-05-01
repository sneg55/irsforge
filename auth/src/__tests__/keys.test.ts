import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'

import {
  exportJwks,
  generateKeyPair,
  type KeyPairResult,
  loadOrGenerateKeys,
} from '../keys/manager.js'

describe('generateKeyPair', () => {
  test('generates an RSA key pair', async () => {
    const keys = await generateKeyPair()
    assert.ok(keys.privateKey, 'privateKey should exist')
    assert.ok(keys.publicKey, 'publicKey should exist')
    assert.ok(keys.kid, 'kid should be set')
    assert.ok(typeof keys.kid === 'string' && keys.kid.length > 0, 'kid should be non-empty string')
  })

  test('each call produces a different kid', async () => {
    const a = await generateKeyPair()
    const b = await generateKeyPair()
    assert.notEqual(a.kid, b.kid, 'different key pairs should have different kids')
  })
})

describe('exportJwks', () => {
  test('exports public key as JWKS with correct fields', async () => {
    const keys = await generateKeyPair()
    const jwks = await exportJwks(keys.publicKey, keys.kid)

    assert.equal(jwks.keys.length, 1, 'JWKS should contain exactly one key')
    const key = jwks.keys[0]
    assert.ok(key, 'key should exist')
    assert.equal(key.kty, 'RSA', 'kty should be RSA')
    assert.equal(key.use, 'sig', 'use should be sig')
    assert.equal(key.alg, 'RS256', 'alg should be RS256')
    assert.equal(key.kid, keys.kid, 'kid should match')
    assert.ok(key.n, 'n (modulus) should be present')
    assert.ok(key.e, 'e (exponent) should be present')
  })
})

describe('loadOrGenerateKeys', () => {
  let tmpDir: string

  test('creates keys in a temp dir when no keys exist', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'irsforge-keys-test-'))
    try {
      const keys = await loadOrGenerateKeys(tmpDir)
      assert.ok(keys.privateKey, 'privateKey should exist')
      assert.ok(keys.publicKey, 'publicKey should exist')
      assert.ok(keys.kid, 'kid should be set')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('reloads existing keys with the same kid', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'irsforge-keys-test-'))
    try {
      const first = await loadOrGenerateKeys(tmpDir)
      const second = await loadOrGenerateKeys(tmpDir)
      assert.equal(first.kid, second.kid, 'reloaded keys should have the same kid')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
