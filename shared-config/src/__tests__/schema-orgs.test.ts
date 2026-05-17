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

describe('orgSchema allowedSubjects / allowedGroups', () => {
  it('accepts orgs without allowedSubjects or allowedGroups (demo profile)', () => {
    const result = orgSchema.safeParse({
      id: 'a',
      party: 'A',
      displayName: 'A',
      hint: 'A',
      role: 'trader',
      ledgerUrl: 'http://localhost:7575',
    })
    assert.equal(result.success, true)
  })

  it('accepts allowedSubjects as a list of strings', () => {
    const result = orgSchema.safeParse({
      id: 'a',
      party: 'A',
      displayName: 'A',
      hint: 'A',
      role: 'trader',
      ledgerUrl: 'http://localhost:7575',
      allowedSubjects: ['alice@goldman.example', 'bob@goldman.example'],
    })
    assert.equal(result.success, true)
  })

  it('accepts allowedGroups as a list of strings', () => {
    const result = orgSchema.safeParse({
      id: 'a',
      party: 'A',
      displayName: 'A',
      hint: 'A',
      role: 'trader',
      ledgerUrl: 'http://localhost:7575',
      allowedGroups: ['goldman-traders'],
    })
    assert.equal(result.success, true)
  })

  it('rejects empty string entries in allowedSubjects', () => {
    const result = orgSchema.safeParse({
      id: 'a',
      party: 'A',
      displayName: 'A',
      hint: 'A',
      role: 'trader',
      ledgerUrl: 'http://localhost:7575',
      allowedSubjects: [''],
    })
    assert.equal(result.success, false)
  })
})

describe('configSchema profile=production + provider=oidc — org membership required', () => {
  const PROD_OIDC_BASE = {
    ...BASE_CONFIG,
    profile: 'production' as const,
    auth: {
      provider: 'oidc' as const,
      builtin: {
        issuer: 'http://localhost:3002',
        keyAlgorithm: 'RS256',
        tokenTtlSeconds: 900,
        refreshTtlSeconds: 86400,
        port: 3002,
      },
      oidc: {
        authority: 'https://idp.example',
        clientId: 'irsforge',
        clientSecret: 'shh',
        scopes: ['openid', 'profile', 'email'],
      },
      serviceAccounts: [
        { id: 'mark-publisher', actAs: ['Operator'], readAs: ['PartyA', 'PartyB'] },
      ],
    },
  }

  it('rejects when a trader org has no allowedSubjects / allowedGroups', () => {
    // Strip allowlists from every org.
    const orgs = VALID_ORGS.map((o) => ({ ...o }))
    const result = configSchema.safeParse({ ...PROD_OIDC_BASE, orgs })
    assert.equal(result.success, false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.message.includes('allowedSubjects'))
      assert.ok(issue, 'expected allowedSubjects-required issue')
    }
  })

  it('accepts when every non-operator org carries at least one allowlist entry', () => {
    const orgs = VALID_ORGS.map((o) =>
      o.role === 'operator' ? { ...o } : { ...o, allowedSubjects: [`${o.id}-admin@example`] },
    )
    const result = configSchema.safeParse({ ...PROD_OIDC_BASE, orgs })
    assert.equal(
      result.success,
      true,
      result.success ? '' : JSON.stringify(result.error.issues, null, 2),
    )
  })

  it('demo profile is exempt from the allowlist requirement', () => {
    // BASE_CONFIG is demo+demo-provider — no allowlists, must still pass.
    const result = configSchema.safeParse({ ...BASE_CONFIG, orgs: VALID_ORGS })
    assert.equal(result.success, true)
  })
})
