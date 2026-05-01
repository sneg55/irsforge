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

describe('configSchema scheduleDefaults', () => {
  it('fills all 8 product keys with per-product defaults when block is omitted', () => {
    const result = configSchema.safeParse(baseConfig)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.scheduleDefaults.IRS.frequencyMonths, 3)
      assert.equal(result.data.scheduleDefaults.OIS.frequencyMonths, 12)
      assert.equal(result.data.scheduleDefaults.BASIS.frequencyMonths, 3)
      assert.equal(result.data.scheduleDefaults.XCCY.frequencyMonths, 6)
      assert.equal(result.data.scheduleDefaults.CDS.frequencyMonths, 3)
      assert.equal(result.data.scheduleDefaults.CCY.frequencyMonths, 3)
      assert.equal(result.data.scheduleDefaults.ASSET.frequencyMonths, 3)
      assert.equal(result.data.scheduleDefaults.FPML.frequencyMonths, 3)
      assert.equal(result.data.scheduleDefaults.OIS.dayCountConvention, 'Act360')
    }
  })

  it('honors an explicit per-product override', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      scheduleDefaults: {
        OIS: { frequencyMonths: 6, dayCountConvention: 'Act365F' },
      },
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.scheduleDefaults.OIS.frequencyMonths, 6)
      assert.equal(result.data.scheduleDefaults.OIS.dayCountConvention, 'Act365F')
      // Other entries fall back to their per-product defaults.
      assert.equal(result.data.scheduleDefaults.IRS.frequencyMonths, 3)
    }
  })

  it('rejects a non-positive frequencyMonths', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      scheduleDefaults: { IRS: { frequencyMonths: 0, dayCountConvention: 'Act360' } },
    })
    assert.equal(result.success, false)
  })

  it('rejects an unknown day-count convention', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      scheduleDefaults: { IRS: { frequencyMonths: 3, dayCountConvention: '30/360' } },
    })
    assert.equal(result.success, false)
  })
})
