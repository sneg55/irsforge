import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

function writeTempConfig(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'irsforge-oracle-'))
  const path = join(dir, 'config.yaml')
  writeFileSync(path, content)
  return path
}

const CONFIG = `
topology: sandbox
routing: path
platform:
  authPublicUrl: http://localhost:3002
  frontendUrl: http://localhost:3000
auth:
  provider: demo
oracle:
  url: http://oracle-host:3001
currencies:
  - code: USD
    label: US Dollar
    calendarId: USD
    isDefault: true
  - code: EUR
    label: Euro
    calendarId: EUR
csa:
  threshold:
    DirA: 0
    DirB: 0
  mta: 100000
  rounding: 10000
  valuationCcy: USD
  eligibleCollateral:
    - currency: USD
      haircut: 1.0
orgs:
  - id: a
    party: A
    displayName: A
    hint: A
    role: trader
    ledgerUrl: http://localhost:7575
  - id: b
    party: B
    displayName: B
    hint: B
    role: trader
    ledgerUrl: http://localhost:7575
  - id: operator
    party: Operator
    displayName: Operator
    hint: Operator
    role: operator
    ledgerUrl: http://localhost:7575
  - id: regulator
    party: Regulator
    displayName: Regulator
    hint: Regulator
    role: regulator
    ledgerUrl: http://localhost:7575
`

describe('/api/oracle/[...path] GET', () => {
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

  it("forwards /rates to oracle's /api/rates", async () => {
    const path = writeTempConfig(CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ rates: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/oracle/rates')
    const res = await GET(req, { params: Promise.resolve({ path: ['rates'] }) })

    expect(fetchMock).toHaveBeenCalledWith('http://oracle-host:3001/api/rates', expect.anything())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ rates: [] })
  })

  it("forwards /health to oracle's /api/health", async () => {
    const path = writeTempConfig(CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/oracle/health')
    await GET(req, { params: Promise.resolve({ path: ['health'] }) })

    expect(fetchMock).toHaveBeenCalledWith('http://oracle-host:3001/api/health', expect.anything())
  })

  it('returns 502 when oracle fetch throws', async () => {
    const path = writeTempConfig(CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const req = new NextRequest('http://localhost:3000/api/oracle/rates')
    const res = await GET(req, { params: Promise.resolve({ path: ['rates'] }) })

    expect(res.status).toBe(502)
  })

  it('propagates non-200 status from oracle', async () => {
    const path = writeTempConfig(CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })))

    const req = new NextRequest('http://localhost:3000/api/oracle/does-not-exist')
    const res = await GET(req, { params: Promise.resolve({ path: ['does-not-exist'] }) })

    expect(res.status).toBe(404)
  })

  it('IRSFORGE_ORACLE_URL env override is respected', async () => {
    const path = writeTempConfig(CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path
    process.env.IRSFORGE_ORACLE_URL = 'http://override-oracle:9999'

    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost:3000/api/oracle/rates')
    await GET(req, { params: Promise.resolve({ path: ['rates'] }) })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://override-oracle:9999/api/rates',
      expect.anything(),
    )
  })
})
