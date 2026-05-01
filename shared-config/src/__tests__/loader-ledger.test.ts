import assert from 'node:assert/strict'
import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { loadConfig } from '../loader.js'

const BASE_YAML = `
topology: sandbox
auth:
  provider: demo
oracle:
  url: http://localhost:8080
platform:
  authPublicUrl: http://localhost:3002
  frontendUrl: http://localhost:3000
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
  - id: alpha
    party: PartyA::ns
    displayName: Alpha Bank
    hint: PartyA
    role: trader
    ledgerUrl: http://localhost:7575
  - id: beta
    party: PartyB::ns
    displayName: Beta Bank
    hint: PartyB
    role: trader
    ledgerUrl: http://localhost:7575
  - id: operator
    party: Operator::ns
    displayName: Operator
    hint: Operator
    role: operator
    ledgerUrl: http://localhost:7575
  - id: regulator
    party: Regulator::ns
    displayName: Regulator
    hint: Regulator
    role: regulator
    ledgerUrl: http://localhost:7575
`

function writeTempYaml(contents: string): string {
  const path = join(tmpdir(), `irsforge-ledger-test-${Date.now()}-${Math.random()}.yaml`)
  writeFileSync(path, contents, 'utf8')
  return path
}

describe('loadConfig — ledger block', () => {
  let tempPath: string | null = null

  afterEach(() => {
    if (tempPath) {
      try {
        unlinkSync(tempPath)
      } catch {
        /* ignore */
      }
      tempPath = null
    }
    delete process.env['IRSFORGE_LEDGER_UPSTREAM_TIMEOUT_MS']
  })

  it('defaults ledger.upstreamTimeoutMs to 15000 when unset', () => {
    tempPath = writeTempYaml(BASE_YAML)
    const config = loadConfig(tempPath)
    assert.equal(config.ledger.upstreamTimeoutMs, 15_000)
  })

  it('reads ledger.upstreamTimeoutMs from YAML', () => {
    tempPath = writeTempYaml(`${BASE_YAML}\nledger:\n  upstreamTimeoutMs: 30000\n`)
    const config = loadConfig(tempPath)
    assert.equal(config.ledger.upstreamTimeoutMs, 30_000)
  })

  it('applies IRSFORGE_LEDGER_UPSTREAM_TIMEOUT_MS env override', () => {
    tempPath = writeTempYaml(BASE_YAML)
    process.env['IRSFORGE_LEDGER_UPSTREAM_TIMEOUT_MS'] = '45000'
    const config = loadConfig(tempPath)
    assert.equal(config.ledger.upstreamTimeoutMs, 45_000)
  })

  it('rejects non-positive IRSFORGE_LEDGER_UPSTREAM_TIMEOUT_MS', () => {
    tempPath = writeTempYaml(BASE_YAML)
    process.env['IRSFORGE_LEDGER_UPSTREAM_TIMEOUT_MS'] = '0'
    assert.throws(() => loadConfig(tempPath!), /upstreamTimeoutMs/)
  })
})
