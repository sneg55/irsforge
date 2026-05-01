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
import { jwtVerify } from 'jose'
import { type KeyPairResult, loadOrGenerateKeys } from '../keys/manager.js'
import { handleOAuthToken } from '../routes/oauth-token.js'
import { readBody, send } from '../routes/shared.js'
import { ServiceAccountsRegistry } from '../service-accounts/registry.js'

// End-to-end HTTP integration test for POST /auth/oauth/token. Boots a real
// http.Server with the same route-dispatch code the production `main()` uses,
// drives it via node-http client requests, and verifies the minted JWT
// against the signing JWK. Does NOT require Canton; safe to run in CI.

const ISSUER = 'https://auth.irsforge.test'
const LEDGER_ID = 'sandbox'
const APP_ID = 'IRSForge'
const TOKEN_TTL = 900

interface HttpResult {
  status: number
  body: unknown
}

async function postForm(
  port: number,
  path: string,
  form: Record<string, string>,
): Promise<HttpResult> {
  const body = new URLSearchParams(form).toString()
  return await new Promise<HttpResult>((resolve, reject) => {
    const req = nodeRequest(
      {
        hostname: '127.0.0.1',
        port,
        method: 'POST',
        path,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let parsed: unknown = raw
          try {
            parsed = JSON.parse(raw)
          } catch {
            /* leave as string */
          }
          resolve({ status: res.statusCode ?? 0, body: parsed })
        })
        res.on('error', reject)
      },
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

describe('POST /auth/oauth/token integration', () => {
  let tempDir: string
  let keys: KeyPairResult
  let registry: ServiceAccountsRegistry
  let server: Server
  let port: number

  before(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'irsforge-oauth-integration-'))
    keys = await loadOrGenerateKeys(tempDir)

    const schedulerHash = await bcrypt.hash('scheduler-secret', 10)
    const yaml = `accounts:\n  - id: "scheduler"\n    clientSecretHash: "${schedulerHash}"`
    registry = ServiceAccountsRegistry.fromYaml(yaml)

    const accounts = [{ id: 'scheduler', actAs: ['Scheduler::1220'], readAs: ['PartyA::1220'] }]

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'POST' && req.url === '/auth/oauth/token') {
        void (async () => {
          const rawBody = await readBody(req)
          const result = await handleOAuthToken(
            { contentType: req.headers['content-type'], rawBody },
            {
              registry,
              keys,
              issuer: ISSUER,
              tokenTtlSeconds: TOKEN_TTL,
              ledgerId: LEDGER_ID,
              applicationId: APP_ID,
              accounts,
            },
          )
          send(res, result.status, result.body)
        })().catch((err: unknown) => {
          send(res, 500, { error: err instanceof Error ? err.message : 'Internal error' })
        })
        return
      }
      send(res, 404, { error: 'not found' })
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const addr = server.address()
    if (addr === null || typeof addr === 'string') {
      throw new Error('server.address() returned unexpected shape')
    }
    port = addr.port
  })

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
    rmSync(tempDir, { recursive: true, force: true })
  })

  test('200 with verifiable JWT for valid client-credentials', async () => {
    const r = await postForm(port, '/auth/oauth/token', {
      grant_type: 'client_credentials',
      client_id: 'scheduler',
      client_secret: 'scheduler-secret',
    })
    assert.equal(r.status, 200)
    const body = r.body as { access_token: string; token_type: string; expires_in: number }
    assert.equal(body.token_type, 'Bearer')
    assert.equal(body.expires_in, TOKEN_TTL)

    const { payload } = await jwtVerify(body.access_token, keys.publicKey)
    assert.equal(payload.iss, ISSUER)
    assert.equal(payload.sub, 'service:scheduler')
    const claim = (payload as Record<string, unknown>)['https://daml.com/ledger-api'] as Record<
      string,
      unknown
    >
    assert.deepEqual(claim['actAs'], ['Scheduler::1220'])
    assert.deepEqual(claim['readAs'], ['PartyA::1220'])
    assert.equal(claim['ledgerId'], LEDGER_ID)
    assert.equal(claim['applicationId'], APP_ID)
  })

  test('401 invalid_client for wrong secret', async () => {
    const r = await postForm(port, '/auth/oauth/token', {
      grant_type: 'client_credentials',
      client_id: 'scheduler',
      client_secret: 'wrong-secret',
    })
    assert.equal(r.status, 401)
    const body = r.body as { error: string }
    assert.equal(body.error, 'invalid_client')
  })

  test('400 unsupported_grant_type for password grant', async () => {
    const r = await postForm(port, '/auth/oauth/token', {
      grant_type: 'password',
      client_id: 'scheduler',
      client_secret: 'scheduler-secret',
    })
    assert.equal(r.status, 400)
    const body = r.body as { error: string }
    assert.equal(body.error, 'unsupported_grant_type')
  })
})
