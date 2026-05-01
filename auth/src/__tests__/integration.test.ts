import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import {
  createServer,
  type IncomingMessage,
  request as nodeRequest,
  type Server,
  type ServerResponse,
} from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'
import bcrypt from 'bcrypt'
import type { Org } from 'irsforge-shared-config'

import { type KeyPairResult, loadOrGenerateKeys } from '../keys/manager.js'
import { BuiltinProvider } from '../providers/builtin.js'
import { handleJwks, resetJwksCache } from '../routes/jwks.js'
import { handleLogin } from '../routes/login.js'
import { handleLogout } from '../routes/logout.js'
import { handleRefresh } from '../routes/refresh.js'
import { RefreshTokenStore } from '../tokens/refresh.js'

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const TEST_ORG: Org = {
  id: 'goldman',
  party: 'PartyA::abc123',
  displayName: 'Goldman Sachs',
  hint: 'goldman',
  ledgerUrl: 'http://localhost:6865',
  subdomain: 'goldman',
}

const ISSUER = 'https://auth.irsforge.test'
const TOKEN_TTL = 900
const REFRESH_TTL = 86400

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface JsonResponse {
  status: number
  headers: Record<string, string | string[]>
  body: unknown
}

async function request(
  port: number,
  method: string,
  path: string,
  opts: { body?: unknown; cookie?: string } = {},
): Promise<JsonResponse> {
  const raw = await new Promise<{
    status: number
    headers: Record<string, string | string[]>
    body: string
  }>((resolve, reject) => {
    const payload = opts.body !== undefined ? JSON.stringify(opts.body) : undefined

    const reqOpts = {
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers: {
        ...(payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {}),
        ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      },
    }

    const req = nodeRequest(reqOpts, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers as Record<string, string | string[]>,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
      res.on('error', reject)
    })

    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })

  let body: unknown
  try {
    body = JSON.parse(raw.body)
  } catch {
    body = raw.body
  }

  return { status: raw.status, headers: raw.headers, body }
}

/** Extract the value of the irsforge_refresh cookie from a Set-Cookie header. */
function extractRefreshToken(headers: Record<string, string | string[]>): string {
  const setCookie = headers['set-cookie']
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie
  assert.ok(cookieStr, 'Set-Cookie header should be present')

  const match = /irsforge_refresh=([^;]+)/.exec(cookieStr)
  assert.ok(match, 'irsforge_refresh cookie should be in Set-Cookie')
  return match[1]
}

// ---------------------------------------------------------------------------
// Integration suite
// ---------------------------------------------------------------------------

describe('Auth integration', () => {
  let tempDir: string
  let keys: KeyPairResult
  let provider: BuiltinProvider
  let tokenStore: RefreshTokenStore
  let server: Server
  let port: number

  before(async () => {
    // 1. Temp dir + RSA keys
    tempDir = mkdtempSync(join(tmpdir(), 'irsforge-auth-integration-'))
    keys = await loadOrGenerateKeys(tempDir)

    // 2. Bcrypt hash for "test123"
    const passwordHash = await bcrypt.hash('test123', 10)

    // 3. BuiltinProvider from inline YAML
    const yaml = [
      'users:',
      `  - username: "admin"`,
      `    passwordHash: "${passwordHash}"`,
      `    orgId: "goldman"`,
      `    actAs: ["PartyA::abc123"]`,
    ].join('\n')

    provider = await BuiltinProvider.fromUsersYaml(yaml, [TEST_ORG])

    // 4. Refresh token store
    tokenStore = new RefreshTokenStore(REFRESH_TTL)

    // 5. HTTP server wiring all route handlers
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? '/'
      const method = req.method ?? 'GET'

      if (method === 'GET' && url === '/.well-known/jwks.json') {
        void handleJwks(req, res, keys)
        return
      }

      if (method === 'POST' && url === '/auth/login') {
        void handleLogin(req, res, {
          provider,
          keys,
          tokenStore,
          issuer: ISSUER,
          tokenTtlSeconds: TOKEN_TTL,
          refreshTtlSeconds: REFRESH_TTL,
          ledgerId: 'sandbox',
          applicationId: 'IRSForge',
        })
        return
      }

      if (method === 'POST' && url === '/auth/refresh') {
        void handleRefresh(req, res, {
          keys,
          tokenStore,
          orgs: [TEST_ORG],
          issuer: ISSUER,
          tokenTtlSeconds: TOKEN_TTL,
          refreshTtlSeconds: REFRESH_TTL,
          ledgerId: 'sandbox',
          applicationId: 'IRSForge',
        })
        return
      }

      if (method === 'POST' && url === '/auth/logout') {
        handleLogout(req, res, { tokenStore })
        return
      }

      if (method === 'GET' && url === '/auth/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok' }))
        return
      }

      res.writeHead(404)
      res.end()
    })

    // 6. Start on random port
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    assert.ok(addr && typeof addr === 'object', 'server address should be an object')
    port = addr.port

    // Reset JWKS module-level cache so each test suite gets a fresh response
    resetJwksCache()
  })

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    )
    rmSync(tempDir, { recursive: true, force: true })
  })

  // -------------------------------------------------------------------------
  test('full login → JWKS → refresh → logout cycle', async () => {
    // -- Step 1: Login --
    const loginRes = await request(port, 'POST', '/auth/login', {
      body: { username: 'admin', password: 'test123', orgId: 'goldman' },
    })

    assert.equal(loginRes.status, 200, 'login should return 200')
    const loginBody = loginRes.body as Record<string, unknown>
    assert.ok(
      typeof loginBody.accessToken === 'string' && loginBody.accessToken.length > 0,
      'accessToken should be present',
    )
    assert.equal(loginBody.userId, 'admin::goldman', 'userId should be admin::goldman')
    assert.equal(loginBody.party, 'PartyA::abc123', 'party should be PartyA::abc123')

    const refreshToken1 = extractRefreshToken(loginRes.headers)

    // -- Step 2: JWKS --
    const jwksRes = await request(port, 'GET', '/.well-known/jwks.json')

    assert.equal(jwksRes.status, 200, 'JWKS should return 200')
    const jwksBody = jwksRes.body as Record<string, unknown>
    assert.ok(Array.isArray(jwksBody.keys), 'JWKS response should have keys array')
    assert.equal((jwksBody.keys as unknown[]).length, 1, 'JWKS should contain exactly one key')
    const jwkKey = (jwksBody.keys as Record<string, unknown>[])[0]
    assert.ok(jwkKey, 'JWK key entry should exist')
    assert.equal(jwkKey.kty, 'RSA', 'key type should be RSA')

    // -- Step 3: Refresh --
    const refreshRes = await request(port, 'POST', '/auth/refresh', {
      cookie: `irsforge_refresh=${refreshToken1}`,
    })

    assert.equal(refreshRes.status, 200, 'refresh should return 200')
    const refreshBody = refreshRes.body as Record<string, unknown>
    assert.ok(
      typeof refreshBody.accessToken === 'string' && refreshBody.accessToken.length > 0,
      'new accessToken should be present',
    )
    assert.equal(refreshBody.userId, 'admin::goldman', 'refreshed userId should be admin::goldman')

    const refreshToken2 = extractRefreshToken(refreshRes.headers)
    assert.notEqual(refreshToken2, refreshToken1, 'new refresh token should differ from old one')

    // Verify old refresh token is now invalid
    const oldTokenRes = await request(port, 'POST', '/auth/refresh', {
      cookie: `irsforge_refresh=${refreshToken1}`,
    })
    assert.equal(oldTokenRes.status, 401, 'old refresh token should be rejected after rotation')

    // -- Step 4: Logout --
    const logoutRes = await request(port, 'POST', '/auth/logout', {
      cookie: `irsforge_refresh=${refreshToken2}`,
    })

    assert.equal(logoutRes.status, 200, 'logout should return 200')

    // Verify refresh fails after logout
    const postLogoutRefreshRes = await request(port, 'POST', '/auth/refresh', {
      cookie: `irsforge_refresh=${refreshToken2}`,
    })
    assert.equal(postLogoutRefreshRes.status, 401, 'refresh should fail after logout')
  })

  // -------------------------------------------------------------------------
  test('rejects invalid credentials', async () => {
    const res = await request(port, 'POST', '/auth/login', {
      body: { username: 'admin', password: 'wrongpassword', orgId: 'goldman' },
    })

    assert.equal(res.status, 401, 'wrong password should return 401')
  })
})
