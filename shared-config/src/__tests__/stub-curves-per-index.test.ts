import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configSchema } from '../schema.js'
import { VALID_ORGS } from './_helpers.js'

const BASE = {
  topology: 'sandbox',
  auth: { provider: 'demo' },
  oracle: { url: 'http://localhost:3001' },
  platform: { authPublicUrl: 'http://localhost:3002', frontendUrl: 'http://localhost:3000' },
  currencies: [{ code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true }],
  csa: {
    threshold: { DirA: 0, DirB: 0 },
    mta: 0,
    rounding: 0,
    valuationCcy: 'USD',
    eligibleCollateral: [{ currency: 'USD', haircut: 1.0 }],
  },
  curves: {
    interpolation: 'LinearZero',
    currencies: {
      USD: {
        dayCount: 'Act360',
        discount: { provider: 'demo-stub' },
        projection: { indexId: 'USD-SOFR', provider: 'demo-stub' },
      },
    },
  },
  floatingRateIndices: {},
  orgs: VALID_ORGS,
}

describe('demo.stubCurves nested projections', () => {
  it('parses projections keyed by indexId', () => {
    const cfg = {
      ...BASE,
      demo: {
        stubCurves: {
          USD: {
            discount: {
              pillars: [
                { tenorDays: 1, zeroRate: 0.05 },
                { tenorDays: 365, zeroRate: 0.04 },
              ],
            },
            projections: {
              'USD-SOFR': {
                pillars: [
                  { tenorDays: 1, zeroRate: 0.05 },
                  { tenorDays: 365, zeroRate: 0.04 },
                ],
              },
              'USD-EFFR': {
                pillars: [
                  { tenorDays: 1, zeroRate: 0.0505 },
                  { tenorDays: 365, zeroRate: 0.04 },
                ],
              },
            },
          },
        },
      },
    }
    const res = configSchema.safeParse(cfg)
    assert.equal(
      res.success,
      true,
      res.success ? '' : JSON.stringify((res as { error: unknown }).error),
    )
  })

  it('rejects old flat projection shape', () => {
    const cfg = {
      ...BASE,
      demo: {
        stubCurves: {
          USD: {
            discount: {
              pillars: [
                { tenorDays: 1, zeroRate: 0.05 },
                { tenorDays: 365, zeroRate: 0.04 },
              ],
            },
            projection: {
              pillars: [
                { tenorDays: 1, zeroRate: 0.05 },
                { tenorDays: 365, zeroRate: 0.04 },
              ],
            },
          },
        },
      },
    }
    const res = configSchema.safeParse(cfg)
    assert.equal(res.success, false, 'expected rejection of flat projection shape')
  })
})
