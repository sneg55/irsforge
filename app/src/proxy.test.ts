import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The proxy caches the loaded routing state at module scope, so every test
// must reset modules and re-import to pick up the config pointed at by
// IRSFORGE_CONFIG_PATH.
async function loadMiddleware() {
  vi.resetModules()
  const mod = await import('./proxy')
  return mod.proxy
}

function writeTempConfig(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'irsforge-middleware-'))
  const path = join(dir, 'config.yaml')
  writeFileSync(path, content)
  return path
}

function makeReq(urlStr: string, host: string) {
  return new NextRequest(urlStr, { headers: { host } })
}

const PATH_MODE_YAML = `
topology: sandbox
routing: path
platform:
  authPublicUrl: http://localhost:3002
  frontendUrl: http://localhost:3000
auth:
  provider: demo
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
    subdomain: goldman
  - id: jpmorgan
    party: PartyB
    displayName: JPMorgan
    hint: PartyB
    role: trader
    ledgerUrl: http://localhost:7575
    subdomain: jpmorgan
  - id: operator
    party: Operator
    displayName: Operator
    hint: Operator
    role: operator
    ledgerUrl: http://localhost:7575
    subdomain: operator
  - id: regulator
    party: Regulator
    displayName: Regulator
    hint: Regulator
    role: regulator
    ledgerUrl: http://localhost:7575
    subdomain: regulator
`

const SUBDOMAIN_MODE_YAML = `
topology: network
routing: subdomain
platform:
  authPublicUrl: http://localhost:3002
  frontendUrl: http://localhost:3000
  frontendUrlTemplate: http://{subdomain}.localhost:3000
auth:
  provider: demo
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
    ledgerUrl: http://goldman:7575
    subdomain: goldman
  - id: jpmorgan
    party: PartyB
    displayName: JPMorgan
    hint: PartyB
    role: trader
    ledgerUrl: http://jpm:7575
    subdomain: jpm
  - id: operator
    party: Operator
    displayName: Operator
    hint: Operator
    role: operator
    ledgerUrl: http://op:7575
    subdomain: operator
  - id: regulator
    party: Regulator
    displayName: Regulator
    hint: Regulator
    role: regulator
    ledgerUrl: http://reg:7575
    subdomain: regulator
`

describe('middleware', () => {
  let originalConfigPath: string | undefined
  const cleanupPaths: string[] = []

  beforeEach(() => {
    originalConfigPath = process.env.IRSFORGE_CONFIG_PATH
  })

  afterEach(() => {
    if (originalConfigPath === undefined) delete process.env.IRSFORGE_CONFIG_PATH
    else process.env.IRSFORGE_CONFIG_PATH = originalConfigPath
    for (const p of cleanupPaths) rmSync(p, { force: true, recursive: true })
    cleanupPaths.length = 0
  })

  describe('path mode', () => {
    beforeEach(() => {
      const path = writeTempConfig(PATH_MODE_YAML)
      cleanupPaths.push(path)
      process.env.IRSFORGE_CONFIG_PATH = path
    })

    it('passes through subdomain-style hostnames without rewriting', async () => {
      const middleware = await loadMiddleware()
      const res = middleware(
        makeReq('https://goldman.irsforge.example.com/blotter', 'goldman.irsforge.example.com'),
      )
      expect(res.headers.get('x-middleware-rewrite')).toBeNull()
    })
  })

  describe('unreadable config (fail-safe)', () => {
    it('defaults to path mode and logs a warning when config is missing', async () => {
      process.env.IRSFORGE_CONFIG_PATH = '/nonexistent/irsforge.yaml'
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const middleware = await loadMiddleware()
      const res = middleware(
        makeReq('https://goldman.irsforge.example.com/blotter', 'goldman.irsforge.example.com'),
      )
      expect(res.headers.get('x-middleware-rewrite')).toBeNull()
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('subdomain mode', () => {
    beforeEach(() => {
      const path = writeTempConfig(SUBDOMAIN_MODE_YAML)
      cleanupPaths.push(path)
      process.env.IRSFORGE_CONFIG_PATH = path
    })

    it('rewrites known subdomain to /org/{orgId}', async () => {
      const middleware = await loadMiddleware()
      const res = middleware(
        makeReq('https://goldman.irsforge.example.com/blotter', 'goldman.irsforge.example.com'),
      )
      const rewrite = res.headers.get('x-middleware-rewrite')
      expect(rewrite).not.toBeNull()
      expect(new URL(rewrite!).pathname).toBe('/org/goldman/blotter')
    })

    it('maps subdomain alias to configured orgId', async () => {
      const middleware = await loadMiddleware()
      const res = middleware(
        makeReq('https://jpm.irsforge.example.com/blotter', 'jpm.irsforge.example.com'),
      )
      const rewrite = res.headers.get('x-middleware-rewrite')
      expect(rewrite).not.toBeNull()
      expect(new URL(rewrite!).pathname).toBe('/org/jpmorgan/blotter')
    })

    it('passes through unknown subdomains rather than rewriting to a nonexistent org', async () => {
      const middleware = await loadMiddleware()
      const res = middleware(
        makeReq('https://attacker.irsforge.example.com/blotter', 'attacker.irsforge.example.com'),
      )
      expect(res.headers.get('x-middleware-rewrite')).toBeNull()
    })

    it('bypasses /api/ paths', async () => {
      const middleware = await loadMiddleware()
      const res = middleware(
        makeReq('https://goldman.irsforge.example.com/api/ledger', 'goldman.irsforge.example.com'),
      )
      expect(res.headers.get('x-middleware-rewrite')).toBeNull()
    })

    it('bypasses /_next/ paths', async () => {
      const middleware = await loadMiddleware()
      const res = middleware(
        makeReq(
          'https://goldman.irsforge.example.com/_next/static/foo.js',
          'goldman.irsforge.example.com',
        ),
      )
      expect(res.headers.get('x-middleware-rewrite')).toBeNull()
    })

    it('bypasses localhost', async () => {
      const middleware = await loadMiddleware()
      const res = middleware(makeReq('http://localhost:3000/blotter', 'localhost:3000'))
      expect(res.headers.get('x-middleware-rewrite')).toBeNull()
    })

    it('does not double-rewrite when path already has /org/{orgId}', async () => {
      const middleware = await loadMiddleware()
      const res = middleware(
        makeReq(
          'https://goldman.irsforge.example.com/org/goldman/blotter',
          'goldman.irsforge.example.com',
        ),
      )
      expect(res.headers.get('x-middleware-rewrite')).toBeNull()
    })
  })
})
