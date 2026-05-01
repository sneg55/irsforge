import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'
import { NETWORK_CONFIG, SANDBOX_CONFIG } from './route.fixtures'

function writeTempConfig(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'irsforge-ledger-route-'))
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

describe('/api/ledger POST — per-org routing', () => {
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

  it('sandbox + no header → forwards to orgs[0].ledgerUrl', async () => {
    const path = writeTempConfig(SANDBOX_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ result: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await POST(makePost({ path: '/v1/query', body: {} }))
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:7575/v1/query')
  })

  it("sandbox + header naming second org → forwards to that org's URL", async () => {
    const path = writeTempConfig(SANDBOX_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ result: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await POST(makePost({ path: '/v1/query', body: {} }, { 'X-Irsforge-Org': 'jpmorgan' }))
    // Same URL in sandbox, but the resolver ran for jpmorgan's entry
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:7575/v1/query')
  })

  it('network + valid header → forwards to matching participant URL', async () => {
    const path = writeTempConfig(NETWORK_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ result: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await POST(makePost({ path: '/v1/query', body: {} }, { 'X-Irsforge-Org': 'jpmorgan' }))
    expect(fetchMock.mock.calls[0][0]).toBe('http://jpmorgan:7575/v1/query')
  })

  it('network + missing header → returns 400', async () => {
    const path = writeTempConfig(NETWORK_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(makePost({ path: '/v1/query', body: {} }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing x-irsforge-org/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('any topology + unknown org id → returns 400', async () => {
    const path = writeTempConfig(SANDBOX_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(
      makePost({ path: '/v1/query', body: {} }, { 'X-Irsforge-Org': 'nonexistent' }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/unknown org: nonexistent/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('network topology + unknown org id → also returns 400', async () => {
    const path = writeTempConfig(NETWORK_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(
      makePost({ path: '/v1/query', body: {} }, { 'X-Irsforge-Org': 'nonexistent' }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/unknown org: nonexistent/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes non-JSON upstream bodies through without crashing (HTML error page)', async () => {
    const path = writeTempConfig(SANDBOX_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const htmlBody = '<html><body>502 Bad Gateway</body></html>'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(htmlBody, {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(makePost({ path: '/v1/query', body: {} }))
    expect(res.status).toBe(502)
    expect(res.headers.get('content-type')).toBe('text/html')
    expect(await res.text()).toBe(htmlBody)
  })

  it('passes empty upstream bodies through without crashing', async () => {
    const path = writeTempConfig(SANDBOX_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(makePost({ path: '/v1/query', body: {} }))
    expect(res.status).toBe(503)
    expect(await res.text()).toBe('')
  })

  it('returns 502 JSON error when upstream fetch rejects (network failure)', async () => {
    const path = writeTempConfig(SANDBOX_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(makePost({ path: '/v1/query', body: {} }))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/ledger unreachable/i)
    expect(body.error).toMatch(/ECONNREFUSED/)
  })

  it('forwards Authorization header to upstream', async () => {
    const path = writeTempConfig(SANDBOX_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ result: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await POST(
      makePost(
        { path: '/v1/query', body: {} },
        { Authorization: 'Bearer my-jwt', 'X-Irsforge-Org': 'goldman' },
      ),
    )
    const upstreamInit = fetchMock.mock.calls[0][1]
    expect(upstreamInit.headers.Authorization).toBe('Bearer my-jwt')
  })
})

describe('/api/ledger GET — per-org routing', () => {
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

  it('sandbox + no header succeeds (pre-login bootstrap path)', async () => {
    const path = writeTempConfig(SANDBOX_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ result: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/ledger?path=/v1/parties', {
      method: 'GET',
    })
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:7575/v1/parties')
  })

  it('network + missing header → returns 400', async () => {
    const path = writeTempConfig(NETWORK_CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/ledger?path=/v1/parties', {
      method: 'GET',
    })
    const res = await GET(req)

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
