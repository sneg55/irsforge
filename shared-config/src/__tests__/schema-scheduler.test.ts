import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configSchema, schedulerSchema } from '../schema.js'
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

describe('schedulerSchema', () => {
  it('accepts the full Stage B scheduler block', () => {
    const result = schedulerSchema.safeParse({
      enabled: true,
      manualOverridesEnabled: false,
      cron: {
        trigger: '*/5 * * * * *',
        settleNet: '*/5 * * * * *',
        mature: '*/30 * * * * *',
      },
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.enabled, true)
      assert.equal(result.data.manualOverridesEnabled, false)
      assert.equal(result.data.cron.mature, '*/30 * * * * *')
    }
  })

  it('defaults: scheduler off, manual overrides on, sub-minute cron', () => {
    const result = schedulerSchema.safeParse({})
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.enabled, false)
      assert.equal(result.data.manualOverridesEnabled, true)
      assert.equal(result.data.cron.trigger, '*/5 * * * * *')
      assert.equal(result.data.cron.settleNet, '*/5 * * * * *')
      assert.equal(result.data.cron.mature, '*/30 * * * * *')
    }
  })

  it('configSchema embeds scheduler with safe defaults when omitted', () => {
    const result = configSchema.safeParse(BASE_CONFIG)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.scheduler.enabled, false)
      assert.equal(result.data.scheduler.manualOverridesEnabled, true)
    }
  })

  it('configSchema accepts an explicit production-shaped scheduler block', () => {
    const result = configSchema.safeParse({
      ...BASE_CONFIG,
      scheduler: {
        enabled: true,
        manualOverridesEnabled: false,
        cron: {
          trigger: '*/5 * * * * *',
          settleNet: '*/5 * * * * *',
          mature: '*/30 * * * * *',
        },
      },
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.scheduler.enabled, true)
      assert.equal(result.data.scheduler.manualOverridesEnabled, false)
    }
  })
})
