import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function writeTempConfig(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'irsforge-'))
  const path = join(dir, 'config.yaml')
  writeFileSync(path, content)
  return path
}

// Shared orgs fixture — covers the platform-role cardinality requirement
// (exactly one operator, at least one regulator, and ≥2 traders) so every
// test that builds a configSchema-valid object can spread this in.
// Every org carries a subdomain so the same fixture is reusable for
// routing: 'subdomain' tests; superRefine only requires `subdomain` when
// routing === 'subdomain', and the path-routing tests don't care.
export const VALID_ORGS = [
  {
    id: 'goldman',
    party: 'PartyA',
    displayName: 'Goldman Sachs',
    hint: 'PartyA',
    role: 'trader',
    ledgerUrl: 'http://localhost:7575',
    subdomain: 'goldman',
  },
  {
    id: 'jpmorgan',
    party: 'PartyB',
    displayName: 'JPMorgan',
    hint: 'PartyB',
    role: 'trader',
    ledgerUrl: 'http://localhost:7575',
    subdomain: 'jpmorgan',
  },
  {
    id: 'operator',
    party: 'Operator',
    displayName: 'Operator',
    hint: 'Operator',
    role: 'operator',
    ledgerUrl: 'http://localhost:7575',
    subdomain: 'operator',
  },
  {
    id: 'regulator',
    party: 'Regulator',
    displayName: 'Regulator',
    hint: 'Regulator',
    role: 'regulator',
    ledgerUrl: 'http://localhost:7575',
    subdomain: 'regulator',
  },
] as const

// Shared CSA fixture used by every test that builds a configSchema-valid object.
// Phase 5 made `csa` a required top-level field; tests that previously could
// elide it now spread VALID_CSA into their baseConfig.
export const VALID_CSA = {
  threshold: { DirA: 0, DirB: 0 },
  mta: 100000,
  rounding: 10000,
  valuationCcy: 'USD',
  eligibleCollateral: [{ currency: 'USD', haircut: 1.0 }],
}

// YAML fragment counterpart of VALID_CSA — concatenated into the inline YAML
// strings used by loader-* tests.
export const CSA_YAML_BLOCK = `
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
`

// YAML fragment counterpart of VALID_ORGS — keeps the role-cardinality
// invariants satisfied (1 operator, ≥1 regulator, and ≥2 traders) without
// each loader test needing to spell out four orgs.
export const ORGS_YAML_BLOCK = `
orgs:
  - id: a
    party: A
    displayName: A
    hint: A
    role: trader
    ledgerUrl: http://localhost:7575
    subdomain: a
  - id: b
    party: B
    displayName: B
    hint: B
    role: trader
    ledgerUrl: http://localhost:7575
    subdomain: b
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

export const VALID_YAML = `
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
    displayName: Goldman Sachs
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
