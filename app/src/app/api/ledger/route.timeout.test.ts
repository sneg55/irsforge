import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const SANDBOX_BASE = `
topology: sandbox
routing: path
auth:
  provider: demo
platform:
  authPublicUrl: http://localhost:3002
  frontendUrl: http://localhost:3000
oracle:
  url: http://localhost:3001
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
  - id: goldman
    party: PartyA
    displayName: Goldman
    hint: PartyA
    role: trader
    ledgerUrl: http://localhost:7575
  - id: jpmorgan
    party: PartyB
    displayName: JPM
    hint: PartyB
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

function writeTempConfig(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'irsforge-ledger-timeout-'))
  const path = join(dir, 'config.yaml')
  writeFileSync(path, content)
  return path
}

function makePost(): NextRequest {
  return new NextRequest('http://localhost:3000/api/ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '/v1/query', body: {} }),
  })
}

describe('/api/ledger POST — upstream timeout', () => {
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

  it('returns 504 when upstream does not respond before timeout', async () => {
    const path = writeTempConfig(`${SANDBOX_BASE}\nledger:\n  upstreamTimeoutMs: 50\n`)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal
          if (!signal) {
            reject(new Error('test: no AbortSignal was passed to fetch'))
            return
          }
          signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const start = Date.now()
    const res = await POST(makePost())
    const elapsed = Date.now() - start

    expect(res.status).toBe(504)
    const body = await res.json()
    expect(body.error).toMatch(/ledger timeout/i)
    expect(elapsed).toBeLessThan(500)
  })

  it('passes AbortSignal into upstream fetch init', async () => {
    const path = writeTempConfig(SANDBOX_BASE)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ result: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await POST(makePost())
    const upstreamInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(upstreamInit.signal).toBeInstanceOf(AbortSignal)
  })
})
