import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { jwtVerify } from 'jose'

import { generateKeyPair } from '../keys/manager.js'
import { createDamlToken } from '../tokens/issuer.js'

const BASE_PARAMS = {
  userId: 'user::alice',
  orgId: 'org-1',
  actAs: ['Alice::party'],
  readAs: ['Alice::party', 'Public::party'],
  issuer: 'https://auth.irsforge.local',
  ttlSeconds: 60,
  ledgerId: 'sandbox',
  applicationId: 'IRSForge',
}

describe('createDamlToken', () => {
  test('creates a valid Daml JWT signed with RS256', async () => {
    const { privateKey, publicKey } = await generateKeyPair()
    const token = await createDamlToken(privateKey, BASE_PARAMS)

    assert.ok(typeof token === 'string' && token.length > 0, 'token should be a non-empty string')

    const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
      issuer: BASE_PARAMS.issuer,
      algorithms: ['RS256'],
    })

    assert.equal(protectedHeader.alg, 'RS256', 'alg header should be RS256')
    assert.equal(payload.iss, BASE_PARAMS.issuer, 'issuer should match')
    assert.equal(payload.sub, BASE_PARAMS.userId, 'subject should be userId')
    assert.ok(payload.iat, 'issuedAt should be set')
    assert.ok(payload.exp, 'expirationTime should be set')
    assert.equal(payload.org, BASE_PARAMS.orgId, 'org claim should be orgId')

    const ledgerClaim = payload['https://daml.com/ledger-api'] as {
      ledgerId: string
      applicationId: string
      actAs: string[]
      readAs: string[]
    }
    assert.ok(ledgerClaim, 'ledger-api claim should be present')
    assert.equal(ledgerClaim.ledgerId, 'sandbox', 'ledgerId should be sandbox')
    assert.equal(ledgerClaim.applicationId, 'IRSForge', 'applicationId should be IRSForge')
    assert.deepEqual(ledgerClaim.actAs, BASE_PARAMS.actAs, 'actAs should match')
    assert.deepEqual(ledgerClaim.readAs, BASE_PARAMS.readAs, 'readAs should match')
  })

  test('exp is set correctly based on ttlSeconds', async () => {
    const { privateKey, publicKey } = await generateKeyPair()
    const ttlSeconds = 120
    const before = Math.floor(Date.now() / 1000)
    const token = await createDamlToken(privateKey, { ...BASE_PARAMS, ttlSeconds })
    const after = Math.floor(Date.now() / 1000)

    const { payload } = await jwtVerify(token, publicKey, { algorithms: ['RS256'] })
    const exp = payload.exp as number
    const iat = payload.iat as number

    assert.ok(exp >= before + ttlSeconds, 'exp should be at least iat + ttlSeconds')
    assert.ok(exp <= after + ttlSeconds + 1, 'exp should not exceed iat + ttlSeconds + 1s skew')
    assert.ok(exp - iat === ttlSeconds, 'exp - iat should equal ttlSeconds')
  })

  test('token is rejected after TTL expires', async () => {
    const { privateKey, publicKey } = await generateKeyPair()
    const token = await createDamlToken(privateKey, { ...BASE_PARAMS, ttlSeconds: 1 })

    // Wait 1500ms so the 1-second token expires
    await new Promise((resolve) => setTimeout(resolve, 1500))

    await assert.rejects(
      () => jwtVerify(token, publicKey, { algorithms: ['RS256'] }),
      /expired/i,
      'expired token should be rejected',
    )
  })
})
