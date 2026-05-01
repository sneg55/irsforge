import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configSchema } from '../schema.js'
import { VALID_CSA, VALID_ORGS } from './_helpers.js'

// `cds` is optional at the top level — a production config that doesn't trade
// CDS can omit it entirely. When present, `referenceNames` must be a non-empty
// array of non-empty strings.
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

describe('configSchema cds', () => {
  it('accepts config without a cds block (CDS not traded)', () => {
    const result = configSchema.safeParse(baseConfig)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.cds, undefined)
    }
  })

  it('accepts cds with a single reference name', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      cds: { referenceNames: ['TSLA'] },
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.deepEqual(result.data.cds?.referenceNames, ['TSLA'])
    }
  })

  it('accepts cds with multiple reference names', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      cds: { referenceNames: ['TSLA', 'AAPL', 'MSFT'] },
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.deepEqual(result.data.cds?.referenceNames, ['TSLA', 'AAPL', 'MSFT'])
    }
  })

  it('rejects cds with an empty referenceNames array', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      cds: { referenceNames: [] },
    })
    assert.equal(result.success, false)
  })

  it('rejects cds with an empty-string reference name', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      cds: { referenceNames: [''] },
    })
    assert.equal(result.success, false)
  })

  it('rejects cds with missing referenceNames', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      cds: {},
    })
    assert.equal(result.success, false)
  })
})
