import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadResolvedConfig } from './server'

function writeTempConfig(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'irsforge-app-'))
  const path = join(dir, 'config.yaml')
  writeFileSync(path, content)
  return path
}

const MINIMAL = `
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

describe('loadResolvedConfig', () => {
  let originalEnv: NodeJS.ProcessEnv
  let tmpFiles: string[] = []

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
    for (const f of tmpFiles) rmSync(f, { force: true })
    tmpFiles = []
  })

  it('reads YAML from IRSFORGE_CONFIG_PATH and returns a validated Config', () => {
    const path = writeTempConfig(MINIMAL)
    tmpFiles.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path
    const config = loadResolvedConfig()
    expect(config.topology).toBe('sandbox')
    expect(config.oracle.url).toBe('http://localhost:3001')
    expect(config.orgs[0].ledgerUrl).toBe('http://localhost:7575')
  })

  it('throws when config is invalid', () => {
    const path = writeTempConfig(`
topology: sandbox
auth:
  provider: demo
oracle:
  url: not-a-url
orgs:
  - id: a
    party: A
    displayName: A
    hint: A
    ledgerUrl: http://localhost:7575
`)
    tmpFiles.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path
    expect(() => loadResolvedConfig()).toThrow(/Invalid config/)
  })

  it('delegates env overrides to shared-config (IRSFORGE_AUTH_PROVIDER)', () => {
    // This specific override used to be ignored by the app loader; if this
    // passes, delegation is live and all 12 shared-config overrides flow through.
    // The YAML fixture starts in demo mode, so it has no serviceAccounts;
    // we add the minimum mark-publisher entry before flipping the provider
    // override so the shared-config superRefine accepts the result.
    const path = writeTempConfig(
      MINIMAL.replace(
        'provider: demo',
        `provider: demo
  builtin:
    issuer: http://auth:3002
  serviceAccounts:
    - id: mark-publisher
      actAs:
        - A`,
      ),
    )
    tmpFiles.push(path)
    process.env.IRSFORGE_CONFIG_PATH = path
    process.env.IRSFORGE_AUTH_PROVIDER = 'builtin'
    const config = loadResolvedConfig()
    expect(config.auth.provider).toBe('builtin')
  })
})
