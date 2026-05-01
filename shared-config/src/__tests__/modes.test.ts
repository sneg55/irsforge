import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configSchema } from '../schema.js'
import { VALID_CSA, VALID_ORGS } from './_helpers.js'

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true },
  { code: 'EUR', label: 'Euro', calendarId: 'EUR', isDefault: false },
]

describe('mode combinations', () => {
  it('sandbox + demo is valid', () => {
    const config = {
      topology: 'sandbox',
      routing: 'path',
      auth: { provider: 'demo' },
      oracle: { url: 'http://localhost:3001' },
      currencies: CURRENCIES,
      csa: VALID_CSA,
      platform: { authPublicUrl: 'http://localhost:3002', frontendUrl: 'http://localhost:3000' },
      orgs: VALID_ORGS,
    }
    assert.equal(configSchema.safeParse(config).success, true)
  })

  it('sandbox + builtin is valid', () => {
    const config = {
      topology: 'sandbox',
      routing: 'path',
      auth: {
        provider: 'builtin',
        builtin: {
          issuer: 'http://localhost:3002',
          tokenTtlSeconds: 900,
          refreshTtlSeconds: 86400,
        },
        serviceAccounts: [{ id: 'mark-publisher', actAs: ['Operator'] }],
      },
      oracle: { url: 'http://localhost:3001' },
      currencies: CURRENCIES,
      csa: VALID_CSA,
      platform: { authPublicUrl: 'http://localhost:3002', frontendUrl: 'http://localhost:3000' },
      orgs: VALID_ORGS,
    }
    assert.equal(configSchema.safeParse(config).success, true)
  })

  it('network + oidc is valid', () => {
    const config = {
      topology: 'network',
      routing: 'subdomain',
      auth: {
        provider: 'oidc',
        builtin: { issuer: 'https://auth.example.com' },
        oidc: {
          authority: 'https://auth.example.com',
          clientId: 'abc',
          clientSecret: 'xyz',
          scopes: ['openid'],
        },
        serviceAccounts: [{ id: 'mark-publisher', actAs: ['Operator'] }],
      },
      oracle: { url: 'http://localhost:3001' },
      currencies: CURRENCIES,
      csa: VALID_CSA,
      platform: {
        authPublicUrl: 'https://auth.example.com',
        frontendUrl: 'https://app.example.com',
        frontendUrlTemplate: 'https://{subdomain}.example.com',
      },
      orgs: VALID_ORGS,
    }
    assert.equal(configSchema.safeParse(config).success, true)
  })

  it('network + demo is valid (insecure but allowed)', () => {
    const config = {
      topology: 'network',
      routing: 'path',
      auth: { provider: 'demo' },
      oracle: { url: 'http://localhost:3001' },
      currencies: CURRENCIES,
      csa: VALID_CSA,
      platform: { authPublicUrl: 'http://localhost:3002', frontendUrl: 'http://localhost:3000' },
      orgs: VALID_ORGS,
    }
    assert.equal(configSchema.safeParse(config).success, true)
  })

  it('subdomain routing requires every org to have a subdomain', () => {
    // VALID_ORGS already carries subdomain everywhere; strip it from one
    // org to exercise the missing-subdomain branch in superRefine.
    const orgsMissingSubdomain = VALID_ORGS.map((o, i) => {
      if (i !== 1) return o
      const { subdomain: _drop, ...rest } = o
      return rest
    })
    const config = {
      topology: 'network',
      routing: 'subdomain',
      auth: { provider: 'demo' },
      oracle: { url: 'http://localhost:3001' },
      currencies: CURRENCIES,
      csa: VALID_CSA,
      platform: {
        authPublicUrl: 'https://auth.example.com',
        frontendUrl: 'https://app.example.com',
        frontendUrlTemplate: 'https://{subdomain}.example.com',
      },
      orgs: orgsMissingSubdomain,
    }
    const result = configSchema.safeParse(config)
    assert.equal(result.success, false)

    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'orgs.1.subdomain')
      assert.ok(issue, 'expected missing-subdomain issue on orgs[1]')
    }
  })

  it('path routing does not require subdomain', () => {
    const config = {
      topology: 'network',
      routing: 'path',
      auth: { provider: 'demo' },
      oracle: { url: 'http://localhost:3001' },
      currencies: CURRENCIES,
      csa: VALID_CSA,
      platform: { authPublicUrl: 'http://localhost:3002', frontendUrl: 'http://localhost:3000' },
      orgs: VALID_ORGS,
    }
    assert.equal(configSchema.safeParse(config).success, true)
  })
})
