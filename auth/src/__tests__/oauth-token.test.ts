import assert from 'node:assert/strict'
import { generateKeyPair } from 'node:crypto'
import { before, describe, test } from 'node:test'
import { promisify } from 'node:util'
import bcrypt from 'bcrypt'
import { exportJWK, importJWK, jwtVerify } from 'jose'
import { handleOAuthToken } from '../routes/oauth-token.js'
import { ServiceAccountsRegistry } from '../service-accounts/registry.js'

const generate = promisify(generateKeyPair)

interface TestKeyPair {
  publicKey: CryptoKey
  privateKey: CryptoKey
  jwk: unknown
}

let keys: TestKeyPair
let registry: ServiceAccountsRegistry

before(async () => {
  const kp = await generate('rsa', { modulusLength: 2048 })
  const publicJwk = await exportJWK(kp.publicKey)
  publicJwk.kid = 'test-kid'
  publicJwk.alg = 'RS256'
  publicJwk.use = 'sig'
  keys = {
    publicKey: (await importJWK(publicJwk, 'RS256')) as CryptoKey,
    privateKey: (await importJWK(await exportJWK(kp.privateKey), 'RS256')) as CryptoKey,
    jwk: publicJwk,
  }
  const schedulerHash = await bcrypt.hash('scheduler-secret', 10)
  const yaml = `accounts:\n  - id: "scheduler"\n    clientSecretHash: "${schedulerHash}"`
  registry = ServiceAccountsRegistry.fromYaml(yaml)
})

const ctx = () => ({
  registry,
  keys: { privateKey: keys.privateKey, publicKey: keys.publicKey, kid: 'test-kid' },
  issuer: 'http://localhost:3002',
  tokenTtlSeconds: 900,
  ledgerId: 'sandbox',
  applicationId: 'IRSForge',
  accounts: [{ id: 'scheduler', actAs: ['Scheduler::1220'], readAs: ['PartyA::1220'] }],
})

function urlencoded(body: Record<string, string>): string {
  return new URLSearchParams(body).toString()
}

describe('handleOAuthToken', () => {
  test('200 with access_token for valid client-credentials', async () => {
    const r = await handleOAuthToken(
      {
        contentType: 'application/x-www-form-urlencoded',
        rawBody: urlencoded({
          grant_type: 'client_credentials',
          client_id: 'scheduler',
          client_secret: 'scheduler-secret',
        }),
      },
      ctx(),
    )
    assert.equal(r.status, 200)
    assert.equal(r.body.token_type, 'Bearer')
    assert.equal(r.body.expires_in, 900)
    const { payload } = await jwtVerify(r.body.access_token as string, keys.publicKey)
    assert.equal(payload.iss, 'http://localhost:3002')
    assert.equal(payload.sub, 'service:scheduler')
    const claim = (payload as Record<string, unknown>)['https://daml.com/ledger-api'] as Record<
      string,
      unknown
    >
    assert.deepEqual(claim.actAs, ['Scheduler::1220'])
    assert.deepEqual(claim.readAs, ['PartyA::1220'])
    assert.equal(claim.ledgerId, 'sandbox')
    assert.equal(claim.applicationId, 'IRSForge')
  })

  test('400 unsupported_grant_type for wrong grant', async () => {
    const r = await handleOAuthToken(
      {
        contentType: 'application/x-www-form-urlencoded',
        rawBody: urlencoded({
          grant_type: 'password',
          client_id: 'scheduler',
          client_secret: 'scheduler-secret',
        }),
      },
      ctx(),
    )
    assert.equal(r.status, 400)
    assert.equal(r.body.error, 'unsupported_grant_type')
  })

  test('400 invalid_request when client_id missing', async () => {
    const r = await handleOAuthToken(
      {
        contentType: 'application/x-www-form-urlencoded',
        rawBody: urlencoded({
          grant_type: 'client_credentials',
          client_secret: 'scheduler-secret',
        }),
      },
      ctx(),
    )
    assert.equal(r.status, 400)
    assert.equal(r.body.error, 'invalid_request')
  })

  test('401 invalid_client for unknown client_id', async () => {
    const r = await handleOAuthToken(
      {
        contentType: 'application/x-www-form-urlencoded',
        rawBody: urlencoded({
          grant_type: 'client_credentials',
          client_id: 'ghost',
          client_secret: 'anything',
        }),
      },
      ctx(),
    )
    assert.equal(r.status, 401)
    assert.equal(r.body.error, 'invalid_client')
  })

  test('401 invalid_client for wrong secret', async () => {
    const r = await handleOAuthToken(
      {
        contentType: 'application/x-www-form-urlencoded',
        rawBody: urlencoded({
          grant_type: 'client_credentials',
          client_id: 'scheduler',
          client_secret: 'wrong',
        }),
      },
      ctx(),
    )
    assert.equal(r.status, 401)
    assert.equal(r.body.error, 'invalid_client')
  })

  test('500 when client_id authenticated but not in config.accounts', async () => {
    const r = await handleOAuthToken(
      {
        contentType: 'application/x-www-form-urlencoded',
        rawBody: urlencoded({
          grant_type: 'client_credentials',
          client_id: 'scheduler',
          client_secret: 'scheduler-secret',
        }),
      },
      { ...ctx(), accounts: [] },
    )
    assert.equal(r.status, 500)
    assert.equal(r.body.error, 'server_error')
  })

  test('415 for wrong content type', async () => {
    const r = await handleOAuthToken(
      {
        contentType: 'application/json',
        rawBody: '{"grant_type":"client_credentials"}',
      },
      ctx(),
    )
    assert.equal(r.status, 415)
    assert.equal(r.body.error, 'invalid_request')
  })
})
