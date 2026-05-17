import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { NETWORK_CONFIG, SANDBOX_CONFIG } from './route.fixtures'

// Phase A.3 (post-launch hardening, issue 6): the proxy must bind the
// X-Irsforge-Org header to the bearer JWT's `org` claim. Defence in
// depth — Canton rejects a token signed for a different participant,
// but the proxy should fail closed before forwarding cross-participant.

function writeTempConfig(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'irsforge-ledger-route-orgbind-'))
  const path = join(dir, 'config.yaml')
  writeFileSync(path, content)
  return path
}

function makePost(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest('http://localhost:3000/api/ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function b64url(o: object): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}

function mkJwt(payload: Record<string, unknown>, alg = 'RS256'): string {
  return `${b64url({ alg, typ: 'JWT' })}.${b64url(payload)}.fake-sig`
}

describe('/api/ledger POST — JWT org-claim binding', () => {
  let originalEnv: NodeJS.ProcessEnv
  let cleanupPaths: string[] = []

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    for (const p of cleanupPaths) rmSync(p, { force: true })
    cleanupPaths = []
  })

  it('rejects with 403 when bearer JWT org claim mismatches header', async () => {
    const path = writeTempConfig(NETWORK_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const jwt = mkJwt({
      org: 'goldman',
      'https://daml.com/ledger-api': { actAs: ['PartyA'] },
    })

    const res = await POST(
      makePost(
        { path: '/v1/query', body: {} },
        { Authorization: `Bearer ${jwt}`, 'X-Irsforge-Org': 'jpmorgan' },
      ),
    )
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.error).toMatch(/org mismatch/i)
  })

  it('forwards when bearer JWT org claim matches header', async () => {
    const path = writeTempConfig(NETWORK_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ result: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const jwt = mkJwt({ org: 'jpmorgan' })

    await POST(
      makePost(
        { path: '/v1/query', body: {} },
        { Authorization: `Bearer ${jwt}`, 'X-Irsforge-Org': 'jpmorgan' },
      ),
    )
    expect(fetchMock).toHaveBeenCalled()
    expect(fetchMock.mock.calls[0][0]).toBe('http://jpmorgan:7575/v1/query')
  })

  it('allows JWT without org claim (demo HS256 bootstrap) — no enforcement', async () => {
    const path = writeTempConfig(SANDBOX_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ result: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    // Demo HS256 mint (app/src/shared/ledger/parties.ts) omits the `org`
    // claim. Proxy can't enforce a binding it never sees — must forward
    // so pre-login bootstrap and demo flows keep working.
    const jwt = mkJwt({ 'https://daml.com/ledger-api': { actAs: ['PartyA'] } }, 'HS256')

    const res = await POST(
      makePost(
        { path: '/v1/query', body: {} },
        { Authorization: `Bearer ${jwt}`, 'X-Irsforge-Org': 'goldman' },
      ),
    )
    expect(res.status).toBe(200)
  })

  it('allows when no Authorization header (sandbox bootstrap)', async () => {
    const path = writeTempConfig(SANDBOX_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ result: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(
      makePost({ path: '/v1/query', body: {} }, { 'X-Irsforge-Org': 'goldman' }),
    )
    expect(res.status).toBe(200)
  })

  it('allows JWT with org claim when no header is present', async () => {
    // No header = no opinion on routing; falls back to orgs[0] in sandbox.
    // Don't require header presence — only that, when present, it agrees.
    const path = writeTempConfig(SANDBOX_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ result: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const jwt = mkJwt({ org: 'goldman' })

    const res = await POST(
      makePost({ path: '/v1/query', body: {} }, { Authorization: `Bearer ${jwt}` }),
    )
    expect(res.status).toBe(200)
  })
})
