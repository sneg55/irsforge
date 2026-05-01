import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configSchema, partiesSchema } from '../schema.js'
import { VALID_CSA, VALID_ORGS } from './_helpers.js'

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true },
  { code: 'EUR', label: 'Euro', calendarId: 'EUR', isDefault: false },
]

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

describe('partiesSchema', () => {
  it('accepts explicit scheduler.partyHint', () => {
    const result = partiesSchema.safeParse({
      scheduler: { partyHint: 'scheduler' },
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.scheduler.partyHint, 'scheduler')
    }
  })

  it('defaults scheduler.partyHint to Scheduler when parties omitted', () => {
    const result = partiesSchema.safeParse(undefined)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.scheduler.partyHint, 'Scheduler')
    }
  })

  it('defaults scheduler.partyHint when parties is empty object', () => {
    const result = partiesSchema.safeParse({})
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.scheduler.partyHint, 'Scheduler')
    }
  })

  it('rejects empty partyHint string', () => {
    const result = partiesSchema.safeParse({
      scheduler: { partyHint: '' },
    })
    assert.equal(result.success, false)
  })
})

describe('configSchema parties integration', () => {
  it('accepts top-level parties block', () => {
    const result = configSchema.safeParse({
      ...BASE_CONFIG,
      parties: { scheduler: { partyHint: 'scheduler' } },
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.parties.scheduler.partyHint, 'scheduler')
    }
  })

  it('applies parties default when the block is omitted', () => {
    const result = configSchema.safeParse(BASE_CONFIG)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.parties.scheduler.partyHint, 'Scheduler')
    }
  })
})
