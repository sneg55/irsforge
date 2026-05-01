import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configSchema } from '../schema.js'
import { VALID_CSA } from './_helpers.js'

const ORG = {
  id: 'op',
  party: 'Op',
  displayName: 'Op',
  hint: 'Op',
  role: 'trader',
  ledgerUrl: 'http://localhost:7575',
}
const ORACLE = { url: 'http://localhost:3001' }
const PLATFORM = { authPublicUrl: 'http://localhost:3002', frontendUrl: 'http://localhost:3000' }
const CURRENCIES = [
  { code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true },
  { code: 'EUR', label: 'Euro', calendarId: 'EUR', isDefault: false },
]

describe('configSchema invalid configs', () => {
  it('rejects empty topology', () => {
    const result = configSchema.safeParse({
      topology: 'cloud',
      auth: { provider: 'demo' },
      oracle: ORACLE,
      platform: PLATFORM,
      orgs: [ORG],
    })
    assert.equal(result.success, false)
  })

  it('rejects unknown auth provider', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: { provider: 'magic' },
      oracle: ORACLE,
      platform: PLATFORM,
      orgs: [ORG],
    })
    assert.equal(result.success, false)
  })

  it('rejects empty orgs array', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: { provider: 'demo' },
      oracle: ORACLE,
      platform: PLATFORM,
      orgs: [],
    })
    assert.equal(result.success, false)
  })

  it('rejects org with invalid ledgerUrl', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: { provider: 'demo' },
      oracle: ORACLE,
      platform: PLATFORM,
      orgs: [{ ...ORG, ledgerUrl: 'not-a-url' }],
    })
    assert.equal(result.success, false)
  })

  it('rejects builtin auth with invalid issuer URL', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: { provider: 'builtin', builtin: { issuer: 'not-a-url' } },
      oracle: ORACLE,
      platform: PLATFORM,
      orgs: [ORG],
    })
    assert.equal(result.success, false)
  })

  it('rejects oidc auth with invalid authority URL', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      auth: {
        provider: 'oidc',
        oidc: { authority: 'not-a-url', clientId: 'app', clientSecret: 'secret' },
      },
      oracle: ORACLE,
      platform: PLATFORM,
      orgs: [ORG],
    })
    assert.equal(result.success, false)
  })

  it('rejects missing topology', () => {
    const result = configSchema.safeParse({
      auth: { provider: 'demo' },
      oracle: ORACLE,
      platform: PLATFORM,
      orgs: [ORG],
    })
    assert.equal(result.success, false)
  })

  it('rejects invalid routing value', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      routing: 'hash',
      auth: { provider: 'demo' },
      oracle: ORACLE,
      platform: PLATFORM,
      orgs: [ORG],
    })
    assert.equal(result.success, false)
  })

  it('rejects config with no oracle', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      routing: 'path',
      auth: { provider: 'demo' },
      platform: PLATFORM,
      orgs: [ORG],
    })
    assert.equal(result.success, false)
  })

  it('rejects config with non-URL oracle.url', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      routing: 'path',
      auth: { provider: 'demo' },
      oracle: { url: 'not a url' },
      platform: PLATFORM,
      orgs: [ORG],
    })
    assert.equal(result.success, false)
  })

  it('rejects config missing platform', () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      routing: 'path',
      auth: { provider: 'demo' },
      oracle: ORACLE,
      orgs: [ORG],
    })
    assert.equal(result.success, false)
  })

  it("rejects platform.authPublicUrl that isn't a URL", () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      routing: 'path',
      auth: { provider: 'demo' },
      oracle: ORACLE,
      platform: { ...PLATFORM, authPublicUrl: 'not-a-url' },
      orgs: [ORG],
    })
    assert.equal(result.success, false)
  })

  it("rejects platform.frontendUrl that isn't a URL", () => {
    const result = configSchema.safeParse({
      topology: 'sandbox',
      routing: 'path',
      auth: { provider: 'demo' },
      oracle: ORACLE,
      platform: { ...PLATFORM, frontendUrl: 'not-a-url' },
      orgs: [ORG],
    })
    assert.equal(result.success, false)
  })

  it('rejects subdomain routing without frontendUrlTemplate', () => {
    const result = configSchema.safeParse({
      topology: 'network',
      routing: 'subdomain',
      auth: { provider: 'demo' },
      oracle: ORACLE,
      platform: PLATFORM, // no frontendUrlTemplate
      currencies: CURRENCIES,
      csa: VALID_CSA,
      orgs: [{ ...ORG, subdomain: 'op' }],
    })
    assert.equal(result.success, false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join('.') === 'platform.frontendUrlTemplate',
      )
      assert.ok(issue, 'expected missing-template issue on platform.frontendUrlTemplate')
    }
  })

  it('rejects frontendUrlTemplate without the {subdomain} token', () => {
    const result = configSchema.safeParse({
      topology: 'network',
      routing: 'subdomain',
      auth: { provider: 'demo' },
      oracle: ORACLE,
      platform: {
        ...PLATFORM,
        frontendUrlTemplate: 'https://noplaceholder.example.com',
      },
      currencies: CURRENCIES,
      csa: VALID_CSA,
      orgs: [{ ...ORG, subdomain: 'op' }],
    })
    assert.equal(result.success, false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join('.') === 'platform.frontendUrlTemplate',
      )
      assert.ok(issue, 'expected missing-{subdomain}-token issue on platform.frontendUrlTemplate')
    }
  })
})
