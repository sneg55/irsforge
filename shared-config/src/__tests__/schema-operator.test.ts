import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configSchema, operatorSchema } from '../schema.js'
import { VALID_CSA, VALID_ORGS } from './_helpers.js'

const CURRENCIES = [{ code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true }]

const BASE_CONFIG = {
  topology: 'sandbox' as const,
  auth: { provider: 'demo' as const },
  oracle: { url: 'http://localhost:3001' },
  platform: {
    authPublicUrl: 'http://localhost:3002',
    frontendUrl: 'http://localhost:3000',
  },
  currencies: CURRENCIES,
  csa: VALID_CSA,
  orgs: VALID_ORGS,
}

const ALL_FAMILIES = ['IRS', 'OIS', 'BASIS', 'XCCY', 'CDS', 'CCY', 'FX', 'ASSET', 'FpML'] as const

describe('operatorSchema', () => {
  it('parses operator.policy.IRS: manual successfully', () => {
    const result = operatorSchema.safeParse({ policy: { IRS: 'manual' } })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.policy.IRS, 'manual')
    }
  })

  it('rejects operator.policy.IRS: bogus with a zod error', () => {
    const result = operatorSchema.safeParse({ policy: { IRS: 'bogus' } })
    assert.equal(result.success, false)
  })

  it('defaults all 9 families to auto when operator key is omitted from configSchema', () => {
    const result = configSchema.safeParse(BASE_CONFIG)
    assert.equal(result.success, true)
    if (result.success) {
      for (const family of ALL_FAMILIES) {
        assert.equal(
          result.data.operator.policy[family],
          'auto',
          `expected policy.${family} to be 'auto'`,
        )
      }
    }
  })

  it('defaults all 9 families to auto when operator: {} is provided', () => {
    const result = configSchema.safeParse({ ...BASE_CONFIG, operator: {} })
    assert.equal(result.success, true)
    if (result.success) {
      for (const family of ALL_FAMILIES) {
        assert.equal(
          result.data.operator.policy[family],
          'auto',
          `expected policy.${family} to be 'auto' with operator: {}`,
        )
      }
    }
  })

  it('partial policy: CDS=manual, rest=auto', () => {
    const result = configSchema.safeParse({
      ...BASE_CONFIG,
      operator: { policy: { CDS: 'manual' } },
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.operator.policy.CDS, 'manual')
      for (const family of ALL_FAMILIES) {
        if (family === 'CDS') continue
        assert.equal(
          result.data.operator.policy[family],
          'auto',
          `expected policy.${family} to be 'auto' in partial config`,
        )
      }
    }
  })
})
