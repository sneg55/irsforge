import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configSchema } from '../schema.js'
import { VALID_CSA, VALID_ORGS } from './_helpers.js'

const baseConfig = {
  topology: 'sandbox',
  auth: { provider: 'demo' },
  oracle: { url: 'http://localhost:4000' },
  platform: {
    authPublicUrl: 'http://localhost:3002',
    frontendUrl: 'http://localhost:3000',
  },
  csa: VALID_CSA,
  orgs: VALID_ORGS,
}

describe('configSchema currencies', () => {
  it('accepts USD + EUR with exactly one default', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      currencies: [
        { code: 'USD', label: 'US Dollar', calendarId: 'NYC', isDefault: true },
        { code: 'EUR', label: 'Euro', calendarId: 'TGT', isDefault: false },
      ],
    })
    assert.equal(result.success, true)
  })

  it('rejects missing currencies block', () => {
    const result = configSchema.safeParse({ ...baseConfig })
    assert.equal(result.success, false)
  })

  it('rejects zero defaults', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      currencies: [
        { code: 'USD', label: 'US Dollar', calendarId: 'NYC', isDefault: false },
        { code: 'EUR', label: 'Euro', calendarId: 'TGT', isDefault: false },
      ],
    })
    assert.equal(result.success, false)
  })

  it('rejects multiple defaults', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      currencies: [
        { code: 'USD', label: 'US Dollar', calendarId: 'NYC', isDefault: true },
        { code: 'EUR', label: 'Euro', calendarId: 'TGT', isDefault: true },
      ],
    })
    assert.equal(result.success, false)
  })

  it('rejects duplicate codes', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      currencies: [
        { code: 'USD', label: 'US Dollar', calendarId: 'NYC', isDefault: true },
        { code: 'USD', label: 'US Dollar Dup', calendarId: 'NYC', isDefault: false },
      ],
    })
    assert.equal(result.success, false)
  })

  it('rejects non-3-letter code', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      currencies: [{ code: 'USDT', label: 'Tether', calendarId: 'NYC', isDefault: true }],
    })
    assert.equal(result.success, false)
  })
})
