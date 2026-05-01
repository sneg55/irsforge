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

describe('configSchema observables', () => {
  it('applies sensible defaults when the block is omitted (IRS/OIS/CDS/CCY/FX/FpML on, BASIS/XCCY/ASSET off)', () => {
    const result = configSchema.safeParse(baseConfig)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.observables.IRS.enabled, true)
      assert.equal(result.data.observables.OIS.enabled, true)
      assert.equal(result.data.observables.BASIS.enabled, false)
      assert.equal(result.data.observables.XCCY.enabled, false)
      assert.equal(result.data.observables.CDS.enabled, true)
      assert.equal(result.data.observables.CCY.enabled, true)
      assert.equal(result.data.observables.FX.enabled, true)
      assert.equal(result.data.observables.ASSET.enabled, false)
      assert.equal(result.data.observables.FpML.enabled, true)
    }
  })

  it('accepts an explicit YAML block and honors every flag', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      observables: {
        IRS: { enabled: false },
        CDS: { enabled: false },
        CCY: { enabled: true },
        FX: { enabled: false },
        ASSET: { enabled: true },
        FpML: { enabled: true },
      },
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.observables.IRS.enabled, false)
      assert.equal(result.data.observables.ASSET.enabled, true)
      assert.equal(result.data.observables.FX.enabled, false)
    }
  })

  it('fills in missing per-product entries with their defaults', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      observables: { IRS: { enabled: false } },
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.observables.IRS.enabled, false)
      // Others fall back to their per-product defaults.
      assert.equal(result.data.observables.CDS.enabled, true)
      assert.equal(result.data.observables.ASSET.enabled, false)
    }
  })

  it('rejects a non-boolean enabled field', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      observables: { IRS: { enabled: 'yes' } },
    })
    assert.equal(result.success, false)
  })
})
