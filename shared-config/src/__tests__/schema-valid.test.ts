import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configSchema } from '../schema.js'
import { VALID_CSA, VALID_ORGS } from './_helpers.js'

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true },
  { code: 'EUR', label: 'Euro', calendarId: 'EUR', isDefault: false },
]

describe('configSchema valid configs', () => {
  it('accepts minimal demo config', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: { provider: 'demo' },
      oracle: { url: 'http://localhost:3001' },
      platform: { authPublicUrl: 'http://localhost:3002', frontendUrl: 'http://localhost:3000' },
      currencies: CURRENCIES,
      csa: VALID_CSA,
      orgs: VALID_ORGS,
    })
    assert.equal(result.success, true)
  })

  it('applies default routing=path when omitted', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: { provider: 'demo' },
      oracle: { url: 'http://localhost:3001' },
      platform: { authPublicUrl: 'http://localhost:3002', frontendUrl: 'http://localhost:3000' },
      currencies: CURRENCIES,
      csa: VALID_CSA,
      orgs: VALID_ORGS,
    })
    assert.equal(result.success, true)

    if (result.success) {
      assert.equal(result.data.routing, 'path')
    }
  })

  it('accepts network topology with subdomain routing', () => {
    const result = configSchema.safeParse({
      topology: 'network',
      routing: 'subdomain',
      auth: { provider: 'demo' },
      oracle: { url: 'http://localhost:3001' },
      platform: {
        authPublicUrl: 'https://auth.example.com',
        frontendUrl: 'https://app.example.com',
        frontendUrlTemplate: 'https://{subdomain}.example.com',
      },
      currencies: CURRENCIES,
      csa: VALID_CSA,
      orgs: VALID_ORGS,
    })
    assert.equal(result.success, true)
  })

  it('accepts subdomain routing when platform.frontendUrlTemplate contains {subdomain}', () => {
    const result = configSchema.safeParse({
      topology: 'network',
      routing: 'subdomain',
      auth: { provider: 'demo' },
      oracle: { url: 'http://localhost:3001' },
      platform: {
        authPublicUrl: 'https://auth.example.com',
        frontendUrl: 'https://app.example.com',
        frontendUrlTemplate: 'https://{subdomain}.example.com',
      },
      currencies: CURRENCIES,
      csa: VALID_CSA,
      orgs: VALID_ORGS,
    })
    assert.equal(result.success, true)
  })

  it('accepts multiple orgs', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: { provider: 'demo' },
      oracle: { url: 'http://localhost:3001' },
      platform: { authPublicUrl: 'http://localhost:3002', frontendUrl: 'http://localhost:3000' },
      currencies: CURRENCIES,
      csa: VALID_CSA,
      orgs: VALID_ORGS,
    })
    assert.equal(result.success, true)
  })
})

// Auth-provider-specific valid-config tests (builtin + oidc).
// Demo-provider and topology/routing tests live in the describe block above.

const PLATFORM = { authPublicUrl: 'http://localhost:3002', frontendUrl: 'http://localhost:3000' }

describe('configSchema valid configs — auth providers', () => {
  it('accepts builtin auth with all fields', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: {
        provider: 'builtin',
        builtin: {
          issuer: 'http://localhost:3002',
          keyAlgorithm: 'RS256',
          tokenTtlSeconds: 900,
          refreshTtlSeconds: 86400,
        },
        serviceAccounts: [{ id: 'mark-publisher', actAs: ['Operator'] }],
      },
      oracle: { url: 'http://localhost:3001' },
      platform: PLATFORM,
      currencies: CURRENCIES,
      csa: VALID_CSA,
      orgs: VALID_ORGS,
    })
    assert.equal(result.success, true)
  })

  it('applies builtin auth defaults (keyAlgorithm, ttls)', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: {
        provider: 'builtin',
        builtin: { issuer: 'http://localhost:3002' },
        serviceAccounts: [{ id: 'mark-publisher', actAs: ['Operator'] }],
      },
      oracle: { url: 'http://localhost:3001' },
      platform: PLATFORM,
      currencies: CURRENCIES,
      csa: VALID_CSA,
      orgs: VALID_ORGS,
    })
    assert.equal(result.success, true)

    if (result.success) {
      assert.equal(result.data.auth.builtin?.keyAlgorithm, 'RS256')

      assert.equal(result.data.auth.builtin?.tokenTtlSeconds, 900)

      assert.equal(result.data.auth.builtin?.refreshTtlSeconds, 86400)
    }
  })

  it('accepts oidc auth with required fields', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: {
        provider: 'oidc',
        builtin: { issuer: 'http://localhost:3002' },
        oidc: {
          authority: 'https://auth.example.com',
          clientId: 'irsforge',
          clientSecret: 'secret',
        },
        serviceAccounts: [{ id: 'mark-publisher', actAs: ['Operator'] }],
      },
      oracle: { url: 'http://localhost:3001' },
      platform: PLATFORM,
      currencies: CURRENCIES,
      csa: VALID_CSA,
      orgs: VALID_ORGS,
    })
    assert.equal(result.success, true)
  })

  it('applies oidc default scopes', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: {
        provider: 'oidc',
        builtin: { issuer: 'http://localhost:3002' },
        oidc: {
          authority: 'https://auth.example.com',
          clientId: 'irsforge',
          clientSecret: 'secret',
        },
        serviceAccounts: [{ id: 'mark-publisher', actAs: ['Operator'] }],
      },
      oracle: { url: 'http://localhost:3001' },
      platform: PLATFORM,
      currencies: CURRENCIES,
      csa: VALID_CSA,
      orgs: VALID_ORGS,
    })
    assert.equal(result.success, true)

    if (result.success) {
      assert.deepEqual(result.data.auth.oidc?.scopes, ['openid', 'profile', 'email'])
    }
  })

  it('accepts oidc auth with custom scopes', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: {
        provider: 'oidc',
        builtin: { issuer: 'http://localhost:3002' },
        oidc: {
          authority: 'https://auth.example.com',
          clientId: 'irsforge',
          clientSecret: 'secret',
          scopes: ['openid', 'daml_ledger_api'],
        },
        serviceAccounts: [{ id: 'mark-publisher', actAs: ['Operator'] }],
      },
      oracle: { url: 'http://localhost:3001' },
      platform: PLATFORM,
      currencies: CURRENCIES,
      csa: VALID_CSA,
      orgs: VALID_ORGS,
    })
    assert.equal(result.success, true)

    if (result.success) {
      assert.deepEqual(result.data.auth.oidc?.scopes, ['openid', 'daml_ledger_api'])
    }
  })
})
