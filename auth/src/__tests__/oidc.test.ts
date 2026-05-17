import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import type { Org } from 'irsforge-shared-config'
import { type CryptoKey, exportJWK, generateKeyPair, SignJWT } from 'jose'

import { OidcProvider } from '../providers/oidc.js'

// ---------------------------------------------------------------------------
// Fake IdP — serves discovery, JWKS, and a token endpoint that returns a
// caller-supplied id_token. Test cases sign their own id_tokens (with the
// matching or mismatching key, claims, exp, nonce, etc.) and stash them in
// `nextIdToken` before driving handleCallback.
// ---------------------------------------------------------------------------

const TEST_ORG: Org = {
  id: 'goldman',
  party: 'PartyA::abc',
  displayName: 'Goldman',
  hint: 'goldman',
  role: 'trader',
  ledgerUrl: 'http://localhost:6865',
  subdomain: 'goldman',
}

const CLIENT_ID = 'irsforge-client'
const CLIENT_SECRET = 'shh'
const SCOPES = ['openid', 'email']

let server: Server
let baseUrl: string
let signingKey: CryptoKey
const signingKid = 'test-kid-1'
// Trapdoor for tests to swap in their own id_token per request.
let nextIdToken = ''

before(async () => {
  const kp = await generateKeyPair('RS256')
  signingKey = kp.privateKey
  const publicJwk = await exportJWK(kp.publicKey)
  publicJwk.kid = signingKid
  publicJwk.alg = 'RS256'
  publicJwk.use = 'sig'

  server = createServer((req, res) => {
    const url = req.url ?? '/'
    if (url === '/.well-known/openid-configuration') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/authorize`,
          token_endpoint: `${baseUrl}/token`,
          jwks_uri: `${baseUrl}/jwks`,
        }),
      )
      return
    }
    if (url === '/jwks') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ keys: [publicJwk] }))
      return
    }
    if (url === '/token' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          id_token: nextIdToken,
          access_token: 'fake-access',
          token_type: 'Bearer',
        }),
      )
      return
    }
    res.writeHead(404)
    res.end()
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  baseUrl = `http://127.0.0.1:${port}`
})

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  )
})

function makeProvider(opts?: { orgs?: Org[]; profile?: 'demo' | 'production' }): OidcProvider {
  return new OidcProvider(
    {
      authority: baseUrl,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      scopes: SCOPES,
      callbackUrl: `${baseUrl}/cb`,
    },
    opts?.orgs ?? [TEST_ORG],
    opts?.profile ?? 'demo',
  )
}

interface IdTokenOpts {
  issuer?: string
  audience?: string
  nonce?: string
  expSeconds?: number // seconds from now
  groups?: string[]
  signWith?: CryptoKey // override signing key (for bad-sig case)
  sub?: string
  email?: string
}

async function signIdToken(opts: IdTokenOpts = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (opts.expSeconds ?? 60)
  const jwt = new SignJWT({
    nonce: opts.nonce ?? 'n-default',
    ...(opts.email ? { email: opts.email } : {}),
    ...(opts.groups ? { groups: opts.groups } : {}),
  })
    .setProtectedHeader({ alg: 'RS256', kid: signingKid })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer(opts.issuer ?? baseUrl)
    .setAudience(opts.audience ?? CLIENT_ID)
    .setSubject(opts.sub ?? 'user-123')
  return await jwt.sign(opts.signWith ?? signingKey)
}

describe('OidcProvider.handleCallback', () => {
  it('returns AuthResult for a valid id_token (correct iss/aud/exp/nonce)', async () => {
    const provider = makeProvider()
    nextIdToken = await signIdToken({
      nonce: 'n-good',
      email: 'alice@example.com',
    })
    const result = await provider.handleCallback('code-1', 'goldman', 'n-good')
    assert.equal(result.orgId, 'goldman')
    assert.equal(result.party, 'PartyA::abc')
    assert.equal(result.userId, 'alice@example.com::goldman')
  })

  it('rejects an id_token with a mismatched issuer', async () => {
    const provider = makeProvider()
    nextIdToken = await signIdToken({
      issuer: 'https://evil.example',
      nonce: 'n-iss',
    })
    await assert.rejects(() => provider.handleCallback('code-2', 'goldman', 'n-iss'), /iss/i)
  })

  it('rejects an id_token whose audience is not our clientId', async () => {
    const provider = makeProvider()
    nextIdToken = await signIdToken({
      audience: 'some-other-client',
      nonce: 'n-aud',
    })
    await assert.rejects(() => provider.handleCallback('code-3', 'goldman', 'n-aud'), /aud/i)
  })

  it('rejects an expired id_token', async () => {
    const provider = makeProvider()
    nextIdToken = await signIdToken({ expSeconds: -10, nonce: 'n-exp' })
    await assert.rejects(() => provider.handleCallback('code-4', 'goldman', 'n-exp'), /exp/i)
  })

  it('rejects an id_token whose nonce does not match the expected value', async () => {
    const provider = makeProvider()
    nextIdToken = await signIdToken({ nonce: 'n-attacker' })
    await assert.rejects(() => provider.handleCallback('code-5', 'goldman', 'n-expected'), /nonce/i)
  })

  it('rejects an id_token signed by a key that is not in the JWKS', async () => {
    const provider = makeProvider()
    const otherKp = await generateKeyPair('RS256')
    nextIdToken = await signIdToken({
      nonce: 'n-sig',
      signWith: otherKp.privateKey,
    })
    await assert.rejects(() => provider.handleCallback('code-6', 'goldman', 'n-sig'))
  })

  it('rejects when orgId is unknown (after successful verification)', async () => {
    const provider = makeProvider()
    nextIdToken = await signIdToken({ nonce: 'n-org' })
    await assert.rejects(
      () => provider.handleCallback('code-7', 'unknown-org', 'n-org'),
      /Unknown orgId/,
    )
  })
})

describe('OidcProvider.handleCallback — production org-membership enforcement', () => {
  const goldmanOnly: Org[] = [
    {
      id: 'goldman',
      party: 'PartyA::abc',
      displayName: 'Goldman',
      hint: 'goldman',
      role: 'trader',
      ledgerUrl: 'http://localhost:6865',
      subdomain: 'goldman',
      allowedSubjects: ['alice@goldman.example'],
    },
    {
      id: 'jpmorgan',
      party: 'PartyB::def',
      displayName: 'JPMorgan',
      hint: 'jpmorgan',
      role: 'trader',
      ledgerUrl: 'http://localhost:6865',
      subdomain: 'jpmorgan',
      allowedSubjects: ['bob@jpmorgan.example'],
    },
  ]

  it('rejects cross-org login: alice@goldman cannot mint a token for jpmorgan', async () => {
    const provider = makeProvider({ orgs: goldmanOnly, profile: 'production' })
    nextIdToken = await signIdToken({
      nonce: 'n-cross-org',
      sub: 'alice@goldman.example',
      email: 'alice@goldman.example',
    })
    await assert.rejects(
      () => provider.handleCallback('code-cross', 'jpmorgan', 'n-cross-org'),
      /not authorised for org jpmorgan/i,
    )
  })

  it('accepts when the subject is on the org allowlist', async () => {
    const provider = makeProvider({ orgs: goldmanOnly, profile: 'production' })
    nextIdToken = await signIdToken({
      nonce: 'n-ok-sub',
      sub: 'alice@goldman.example',
      email: 'alice@goldman.example',
    })
    const result = await provider.handleCallback('code-ok-sub', 'goldman', 'n-ok-sub')
    assert.equal(result.orgId, 'goldman')
    assert.equal(result.party, 'PartyA::abc')
  })

  it('accepts via allowedGroups when the id_token carries a matching group', async () => {
    const orgsWithGroups: Org[] = [
      {
        ...goldmanOnly[0],
        allowedSubjects: undefined,
        allowedGroups: ['goldman-traders'],
      },
    ]
    const provider = makeProvider({ orgs: orgsWithGroups, profile: 'production' })
    nextIdToken = await signIdToken({
      nonce: 'n-grp',
      sub: 'anyone',
      groups: ['some-other-group', 'goldman-traders'],
    })
    const result = await provider.handleCallback('code-grp', 'goldman', 'n-grp')
    assert.equal(result.orgId, 'goldman')
  })

  it('rejects when neither subject nor groups match the allowlist', async () => {
    const provider = makeProvider({ orgs: goldmanOnly, profile: 'production' })
    nextIdToken = await signIdToken({
      nonce: 'n-no-match',
      sub: 'charlie@external.example',
      groups: ['random-group'],
    })
    await assert.rejects(
      () => provider.handleCallback('code-no-match', 'goldman', 'n-no-match'),
      /not authorised for org goldman/i,
    )
  })

  it('demo profile bypasses the allowlist check entirely', async () => {
    const provider = makeProvider({ orgs: goldmanOnly, profile: 'demo' })
    nextIdToken = await signIdToken({
      nonce: 'n-demo',
      sub: 'anyone@anywhere.example',
    })
    // Same identity that would be rejected under production → accepted in demo.
    const result = await provider.handleCallback('code-demo', 'goldman', 'n-demo')
    assert.equal(result.orgId, 'goldman')
  })
})

describe('OidcProvider.getAuthorizationUrl', () => {
  it('emits state and nonce as separate URL parameters', () => {
    const provider = makeProvider()
    const url = new URL(provider.getAuthorizationUrl('S', 'N'))
    assert.equal(url.searchParams.get('state'), 'S')
    assert.equal(url.searchParams.get('nonce'), 'N')
    assert.equal(url.searchParams.get('client_id'), CLIENT_ID)
    assert.equal(url.searchParams.get('response_type'), 'code')
  })
})
