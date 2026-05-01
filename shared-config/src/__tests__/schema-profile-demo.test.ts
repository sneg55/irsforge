import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configSchema } from '../schema.js'
import { VALID_CSA, VALID_ORGS } from './_helpers.js'

const baseConfig = {
  topology: 'sandbox',
  auth: { provider: 'demo' },
  oracle: { url: 'http://localhost:3001' },
  platform: {
    authPublicUrl: 'http://localhost:3002',
    frontendUrl: 'http://localhost:3000',
  },
  currencies: [{ code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true }],
  csa: VALID_CSA,
  orgs: VALID_ORGS,
}

describe('configSchema profile + demo subtree', () => {
  it("defaults profile to 'demo' when omitted", () => {
    const result = configSchema.safeParse(baseConfig)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.profile, 'demo')
    }
  })

  it('accepts profile=demo with a populated demo subtree', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      profile: 'demo',
      demo: { cdsStub: { defaultProb: 0.02, recovery: 0.4 } },
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.demo?.cdsStub?.defaultProb, 0.02)
      assert.equal(result.data.demo?.cdsStub?.recovery, 0.4)
    }
  })

  it('accepts profile=production without a demo subtree', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      profile: 'production',
    })
    assert.equal(result.success, true)
  })

  it('rejects profile=production with a populated demo subtree', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      profile: 'production',
      demo: { cdsStub: { defaultProb: 0.02, recovery: 0.4 } },
    })
    assert.equal(result.success, false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'demo')
      assert.ok(issue, 'expected demo-populated-in-production issue')
    }
  })

  it('rejects unknown profile values', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      profile: 'staging',
    })
    assert.equal(result.success, false)
  })

  it('rejects cdsStub probabilities outside [0,1]', () => {
    const negative = configSchema.safeParse({
      ...baseConfig,
      demo: { cdsStub: { defaultProb: -0.01, recovery: 0.4 } },
    })
    assert.equal(negative.success, false)

    const tooBig = configSchema.safeParse({
      ...baseConfig,
      demo: { cdsStub: { defaultProb: 0.02, recovery: 1.5 } },
    })
    assert.equal(tooBig.success, false)
  })
})
