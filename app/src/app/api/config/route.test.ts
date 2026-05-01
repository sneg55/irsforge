import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from './route'
import { ORGS_YAML_BLOCK } from './route.fixtures'

function writeTempConfig(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'irsforge-route-'))
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
  provider: oidc
  builtin:
    issuer: http://auth:3002
  oidc:
    authority: http://auth:3002
    clientId: irsforge-web
    clientSecret: TOP_SECRET
  serviceAccounts:
    - id: mark-publisher
      actAs:
        - A
oracle:
  url: http://oracle:3001
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
${ORGS_YAML_BLOCK}`

describe('/api/config GET', () => {
  let originalEnv: NodeJS.ProcessEnv
  let cleanupPaths: string[] = []

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
    for (const p of cleanupPaths) rmSync(p, { force: true })
    cleanupPaths = []
  })

  it('strips oracle from client response', async () => {
    const path = writeTempConfig(CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const res = await GET()
    const body = await res.json()
    expect(body.oracle).toBeUndefined()
  })

  it('exposes authBaseUrl from platform.authPublicUrl', async () => {
    const path = writeTempConfig(CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const res = await GET()
    const body = await res.json()
    expect(body.authBaseUrl).toBe('http://localhost:3002')
  })

  it('strips OIDC clientSecret', async () => {
    const path = writeTempConfig(CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const res = await GET()
    const body = await res.json()
    expect(body.auth.oidc.clientSecret).toBeUndefined()
    expect(body.auth.oidc.authority).toBe('http://auth:3002')
  })

  it('applies IRSFORGE_OIDC_AUTHORITY env override', async () => {
    const path = writeTempConfig(CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path
    process.env.IRSFORGE_OIDC_AUTHORITY = 'http://override-auth:9000'

    const res = await GET()
    const body = await res.json()
    expect(body.auth.oidc.authority).toBe('http://override-auth:9000')
  })

  it('strips daml.unsafeJwtSecret when provider is not demo', async () => {
    const path = writeTempConfig(CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const res = await GET()
    const body = await res.json()
    expect(body.daml.ledgerId).toBe('sandbox')
    expect(body.daml.applicationId).toBe('IRSForge')
    expect(body.daml.unsafeJwtSecret).toBeUndefined()
  })

  it('exposes daml.unsafeJwtSecret when provider is demo', async () => {
    const demoConfig = `
topology: sandbox
routing: path
platform:
  authPublicUrl: http://localhost:3002
  frontendUrl: http://localhost:3000
auth:
  provider: demo
oracle:
  url: http://oracle:3001
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
${ORGS_YAML_BLOCK}`
    const path = writeTempConfig(demoConfig)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const res = await GET()
    const body = await res.json()
    expect(body.daml.unsafeJwtSecret).toBe('secret')
  })

  it('exposes currencies (USD + EUR, USD default)', async () => {
    const path = writeTempConfig(CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const res = await GET()
    const body = await res.json()
    expect(Array.isArray(body.currencies)).toBe(true)
    const codes = body.currencies.map((c: { code: string }) => c.code)
    expect(codes).toContain('USD')
    expect(codes).toContain('EUR')
    const usd = body.currencies.find((c: { code: string }) => c.code === 'USD')
    expect(usd.isDefault).toBe(true)
  })

  it('exposes observables map with all nine swap-type keys (incl. OIS/BASIS/XCCY)', async () => {
    const path = writeTempConfig(CONFIG)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path

    const res = await GET()
    const body = await res.json()
    expect(body.observables).toBeDefined()
    expect(Object.keys(body.observables).sort()).toEqual(
      ['ASSET', 'BASIS', 'CCY', 'CDS', 'FX', 'FpML', 'IRS', 'OIS', 'XCCY'].sort(),
    )
    expect(Array.isArray(body.observables.IRS.rateIds)).toBe(true)
    expect(body.observables.IRS.rateIds.length).toBeGreaterThanOrEqual(1)
    expect(body.observables.IRS.rateIds).toContain('USD-SOFR')
    expect(body.observables.OIS.rateIds).toContain('USD-SOFR')
    expect(typeof body.observables.CDS.rateIdPattern).toBe('string')
  })

  it('respects IRSFORGE_DAML_UNSAFE_JWT_SECRET override', async () => {
    const demoConfig = `
topology: sandbox
routing: path
platform:
  authPublicUrl: http://localhost:3002
  frontendUrl: http://localhost:3000
auth:
  provider: demo
oracle:
  url: http://oracle:3001
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
${ORGS_YAML_BLOCK}`
    const path = writeTempConfig(demoConfig)
    cleanupPaths.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path
    process.env.IRSFORGE_DAML_UNSAFE_JWT_SECRET = 'rotated-key'

    const res = await GET()
    const body = await res.json()
    expect(body.daml.unsafeJwtSecret).toBe('rotated-key')
  })
})
