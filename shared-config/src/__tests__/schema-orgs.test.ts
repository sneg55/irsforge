import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configSchema, orgRoleSchema, orgSchema } from '../schema.js'
import { VALID_CSA, VALID_ORGS } from './_helpers.js'

const BASE_CONFIG = {
  topology: 'sandbox' as const,
  auth: { provider: 'demo' as const },
  oracle: { url: 'http://localhost:3001' },
  platform: {
    authPublicUrl: 'http://localhost:3002',
    frontendUrl: 'http://localhost:3000',
  },
  currencies: [{ code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true }],
  csa: VALID_CSA,
}

describe('orgSchema role field', () => {
  it('accepts the three role values', () => {
    for (const role of ['trader', 'operator', 'regulator']) {
      assert.equal(orgRoleSchema.safeParse(role).success, true, `role=${role}`)
    }
  })

  it('rejects unknown role values', () => {
    assert.equal(orgRoleSchema.safeParse('custodian').success, false)
    assert.equal(orgRoleSchema.safeParse('').success, false)
  })

  it('treats role as required on orgSchema', () => {
    const result = orgSchema.safeParse({
      id: 'a',
      party: 'A',
      displayName: 'A',
      hint: 'A',
      ledgerUrl: 'http://localhost:7575',
    })
    assert.equal(result.success, false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'role')
      assert.ok(issue, 'expected missing-role issue on orgSchema')
    }
  })
})

describe('configSchema org role cardinality', () => {
  it('rejects zero operators', () => {
    const orgs = VALID_ORGS.filter((o) => o.role !== 'operator')
    const result = configSchema.safeParse({ ...BASE_CONFIG, orgs })
    assert.equal(result.success, false)
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.message.includes('exactly one org must have role: operator'),
      )
      assert.ok(issue, 'expected operator-cardinality issue')
    }
  })

  it('rejects two operators', () => {
    const orgs = [
      ...VALID_ORGS,
      {
        id: 'operator2',
        party: 'Operator2',
        displayName: 'Backup Operator',
        hint: 'Operator2',
        role: 'operator' as const,
        ledgerUrl: 'http://localhost:7575',
      },
    ]
    const result = configSchema.safeParse({ ...BASE_CONFIG, orgs })
    assert.equal(result.success, false)
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.message.includes('exactly one org must have role: operator'),
      )
      assert.ok(issue, 'expected operator-cardinality issue')
    }
  })

  it('rejects zero regulators', () => {
    const orgs = VALID_ORGS.filter((o) => o.role !== 'regulator')
    const result = configSchema.safeParse({ ...BASE_CONFIG, orgs })
    assert.equal(result.success, false)
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.message.includes('at least one org must have role: regulator'),
      )
      assert.ok(issue, 'expected regulator-cardinality issue')
    }
  })

  it('rejects fewer than two traders', () => {
    const orgs = VALID_ORGS.filter((o, i) => o.role !== 'trader' || i === 0)
    const result = configSchema.safeParse({ ...BASE_CONFIG, orgs })
    assert.equal(result.success, false)
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.message.includes('at least two orgs must have role: trader'),
      )
      assert.ok(issue, 'expected trader-cardinality issue')
    }
  })

  it('accepts the canonical 4-org cluster', () => {
    const result = configSchema.safeParse({ ...BASE_CONFIG, orgs: VALID_ORGS })
    assert.equal(result.success, true)
  })
})
