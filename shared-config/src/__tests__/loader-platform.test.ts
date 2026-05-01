import assert from 'node:assert/strict'
import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { loadConfig } from '../loader.js'
import { ORGS_YAML_BLOCK, VALID_YAML, writeTempConfig } from './_helpers.js'

describe('loadConfig — platform block', () => {
  let tmpFile: string

  before(() => {
    tmpFile = join(tmpdir(), `irsforge-platform-${Date.now()}.yaml`)
    writeFileSync(tmpFile, VALID_YAML, 'utf8')
  })

  after(() => {
    try {
      unlinkSync(tmpFile)
    } catch {
      // ignore
    }
  })

  it('applies IRSFORGE_AUTH_PUBLIC_URL and IRSFORGE_FRONTEND_URL overrides', () => {
    process.env['IRSFORGE_AUTH_PUBLIC_URL'] = 'https://auth.override.example'
    process.env['IRSFORGE_FRONTEND_URL'] = 'https://app.override.example'
    try {
      const config = loadConfig(tmpFile)
      assert.equal(config.platform.authPublicUrl, 'https://auth.override.example')
      assert.equal(config.platform.frontendUrl, 'https://app.override.example')
    } finally {
      delete process.env['IRSFORGE_AUTH_PUBLIC_URL']
      delete process.env['IRSFORGE_FRONTEND_URL']
    }
  })

  it('applies IRSFORGE_FRONTEND_URL_TEMPLATE override in subdomain mode', () => {
    const tmp = writeTempConfig(`
topology: network
routing: subdomain
platform:
  authPublicUrl: https://auth.example.com
  frontendUrl: https://app.example.com
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
    ledgerUrl: https://ledger-a.example.com
    subdomain: a
  - id: b
    party: B
    displayName: B
    hint: B
    role: trader
    ledgerUrl: https://ledger-b.example.com
    subdomain: b
  - id: operator
    party: Operator
    displayName: Operator
    hint: Operator
    role: operator
    ledgerUrl: https://ledger-op.example.com
    subdomain: operator
  - id: regulator
    party: Regulator
    displayName: Regulator
    hint: Regulator
    role: regulator
    ledgerUrl: https://ledger-reg.example.com
    subdomain: regulator
`)
    process.env['IRSFORGE_FRONTEND_URL_TEMPLATE'] = 'https://{subdomain}.override.example'
    try {
      const config = loadConfig(tmp)
      assert.equal(config.platform.frontendUrlTemplate, 'https://{subdomain}.override.example')
    } finally {
      delete process.env['IRSFORGE_FRONTEND_URL_TEMPLATE']
    }
  })

  it('defaults auth.builtin.issuer from platform.authPublicUrl when omitted', () => {
    const tmp = writeTempConfig(`
topology: sandbox
platform:
  authPublicUrl: https://auth.example.com
  frontendUrl: https://app.example.com
auth:
  provider: builtin
  builtin: {}
  serviceAccounts:
    - id: mark-publisher
      actAs:
        - Operator
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
${ORGS_YAML_BLOCK}`)
    const config = loadConfig(tmp)
    assert.equal(config.auth.builtin?.issuer, 'https://auth.example.com')
  })

  it('does not overwrite an explicit auth.builtin.issuer', () => {
    const tmp = writeTempConfig(`
topology: sandbox
platform:
  authPublicUrl: https://auth.example.com
  frontendUrl: https://app.example.com
auth:
  provider: builtin
  builtin:
    issuer: https://iss.pinned.example
  serviceAccounts:
    - id: mark-publisher
      actAs:
        - Operator
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
${ORGS_YAML_BLOCK}`)
    const config = loadConfig(tmp)
    assert.equal(config.auth.builtin?.issuer, 'https://iss.pinned.example')
  })
})
