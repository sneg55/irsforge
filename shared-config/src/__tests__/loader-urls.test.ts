import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { loadConfig } from '../loader.js'
import { ORGS_YAML_BLOCK, writeTempConfig } from './_helpers.js'

const PLATFORM_YAML = `
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
`

describe('loadConfig — URL overrides', () => {
  it('IRSFORGE_ORACLE_URL overrides oracle.url', () => {
    const tmp = writeTempConfig(`
topology: sandbox
${PLATFORM_YAML}
auth:
  provider: demo
oracle:
  url: http://original:3001
${ORGS_YAML_BLOCK}`)
    process.env['IRSFORGE_ORACLE_URL'] = 'http://override:9001'
    try {
      const config = loadConfig(tmp)
      assert.equal(config.oracle.url, 'http://override:9001')
    } finally {
      delete process.env['IRSFORGE_ORACLE_URL']
    }
  })

  it('IRSFORGE_LEDGER_URL rewrites all org ledger URLs in sandbox topology', () => {
    const tmp = writeTempConfig(`
topology: sandbox
${PLATFORM_YAML}
auth:
  provider: demo
oracle:
  url: http://localhost:3001
${ORGS_YAML_BLOCK}`)
    process.env['IRSFORGE_LEDGER_URL'] = 'http://custom:9999'
    try {
      const config = loadConfig(tmp)
      assert.equal(config.orgs[0].ledgerUrl, 'http://custom:9999')
      assert.equal(config.orgs[1].ledgerUrl, 'http://custom:9999')
    } finally {
      delete process.env['IRSFORGE_LEDGER_URL']
    }
  })

  it('IRSFORGE_LEDGER_URL is ignored in network topology', () => {
    const tmp = writeTempConfig(`
topology: network
${PLATFORM_YAML}
auth:
  provider: demo
oracle:
  url: http://localhost:3001
orgs:
  - id: a
    party: A
    displayName: A
    hint: A
    role: trader
    ledgerUrl: http://goldman:7575
  - id: b
    party: B
    displayName: B
    hint: B
    role: trader
    ledgerUrl: http://jpmorgan:7575
  - id: operator
    party: Operator
    displayName: Operator
    hint: Operator
    role: operator
    ledgerUrl: http://operator:7575
  - id: regulator
    party: Regulator
    displayName: Regulator
    hint: Regulator
    role: regulator
    ledgerUrl: http://regulator:7575
`)
    process.env['IRSFORGE_LEDGER_URL'] = 'http://wrong:9999'
    try {
      const config = loadConfig(tmp)
      assert.equal(config.orgs[0].ledgerUrl, 'http://goldman:7575')
      assert.equal(config.orgs[1].ledgerUrl, 'http://jpmorgan:7575')
    } finally {
      delete process.env['IRSFORGE_LEDGER_URL']
    }
  })

  it('falls back to LEDGER_URL when IRSFORGE_LEDGER_URL is unset (sandbox)', () => {
    const tmp = writeTempConfig(`
topology: sandbox
${PLATFORM_YAML}
auth:
  provider: demo
oracle:
  url: http://localhost:3001
${ORGS_YAML_BLOCK}`)
    delete process.env['IRSFORGE_LEDGER_URL']
    process.env['LEDGER_URL'] = 'http://legacy:8888'
    try {
      const config = loadConfig(tmp)
      assert.equal(config.orgs[0].ledgerUrl, 'http://legacy:8888')
    } finally {
      delete process.env['LEDGER_URL']
    }
  })

  it('applies IRSFORGE_DAML_* env overrides', () => {
    const tmp = writeTempConfig(`
topology: sandbox
${PLATFORM_YAML}
auth:
  provider: demo
oracle:
  url: http://localhost:3001
${ORGS_YAML_BLOCK}`)
    process.env['IRSFORGE_DAML_LEDGER_ID'] = 'custom-ledger'
    process.env['IRSFORGE_DAML_APPLICATION_ID'] = 'custom-app'
    process.env['IRSFORGE_DAML_UNSAFE_JWT_SECRET'] = 'custom-secret'
    try {
      const config = loadConfig(tmp)
      assert.equal(config.daml.ledgerId, 'custom-ledger')
      assert.equal(config.daml.applicationId, 'custom-app')
      assert.equal(config.daml.unsafeJwtSecret, 'custom-secret')
    } finally {
      delete process.env['IRSFORGE_DAML_LEDGER_ID']
      delete process.env['IRSFORGE_DAML_APPLICATION_ID']
      delete process.env['IRSFORGE_DAML_UNSAFE_JWT_SECRET']
    }
  })
})
