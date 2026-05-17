import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configSchema } from '../schema.js'
import { bootstrapSchema, csaPairSeedSchema } from '../schema-bootstrap.js'
import { VALID_CSA, VALID_ORGS } from './_helpers.js'

const PROD_BASE = {
  topology: 'sandbox' as const,
  profile: 'production' as const,
  auth: { provider: 'demo' as const },
  oracle: { url: 'http://localhost:3001' },
  platform: {
    authPublicUrl: 'http://localhost:3002',
    frontendUrl: 'http://localhost:3000',
  },
  currencies: [{ code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true }],
  csa: VALID_CSA,
  orgs: VALID_ORGS,
}

describe('csaPairSeedSchema', () => {
  it('accepts a minimal pair', () => {
    const r = csaPairSeedSchema.safeParse({ traderAHint: 'PartyA', traderBHint: 'PartyB' })
    assert.equal(r.success, true)
    if (r.success) {
      assert.equal(r.data.isdaMasterAgreementRef, '')
      assert.equal(r.data.governingLaw, 'NewYork')
    }
  })

  it('rejects empty hint strings', () => {
    assert.equal(
      csaPairSeedSchema.safeParse({ traderAHint: '', traderBHint: 'PartyB' }).success,
      false,
    )
    assert.equal(
      csaPairSeedSchema.safeParse({ traderAHint: 'PartyA', traderBHint: '' }).success,
      false,
    )
  })

  it('rejects unknown governingLaw values', () => {
    const r = csaPairSeedSchema.safeParse({
      traderAHint: 'A',
      traderBHint: 'B',
      governingLaw: 'Martian',
    })
    assert.equal(r.success, false)
  })
})

describe('bootstrapSchema', () => {
  it('defaults to an empty csaPairs list when omitted', () => {
    const r = bootstrapSchema.safeParse(undefined)
    assert.equal(r.success, true)
    if (r.success) {
      assert.deepEqual(r.data.csaPairs, [])
    }
  })

  it('passes through a list of pairs', () => {
    const r = bootstrapSchema.safeParse({
      csaPairs: [
        { traderAHint: 'PartyA', traderBHint: 'PartyB' },
        { traderAHint: 'PartyA', traderBHint: 'PartyC' },
      ],
    })
    assert.equal(r.success, true)
    if (r.success) assert.equal(r.data.csaPairs.length, 2)
  })
})

describe('configSchema profile=production — bootstrap.csaPairs validation', () => {
  it('rejects when csaPairs is empty', () => {
    const r = configSchema.safeParse({ ...PROD_BASE })
    assert.equal(r.success, false)
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.message.includes('bootstrap.csaPairs entry'))
      assert.ok(issue, 'expected empty-csaPairs issue')
    }
  })

  it('rejects pair entries naming hints that are not in orgs[]', () => {
    const r = configSchema.safeParse({
      ...PROD_BASE,
      bootstrap: { csaPairs: [{ traderAHint: 'PartyA', traderBHint: 'NonExistent' }] },
    })
    assert.equal(r.success, false)
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.message.includes('NonExistent'))
      assert.ok(issue, 'expected unknown-hint issue')
    }
  })

  it('rejects pair entries where traderAHint == traderBHint', () => {
    const r = configSchema.safeParse({
      ...PROD_BASE,
      bootstrap: { csaPairs: [{ traderAHint: 'PartyA', traderBHint: 'PartyA' }] },
    })
    assert.equal(r.success, false)
    if (!r.success) {
      const issue = r.error.issues.find((i) => /must differ/i.test(i.message))
      assert.ok(issue, 'expected hints-must-differ issue')
    }
  })

  it('accepts a valid single-pair config', () => {
    const r = configSchema.safeParse({
      ...PROD_BASE,
      bootstrap: { csaPairs: [{ traderAHint: 'PartyA', traderBHint: 'PartyB' }] },
    })
    assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error.issues, null, 2))
  })

  it('demo profile does not require csaPairs', () => {
    const r = configSchema.safeParse({ ...PROD_BASE, profile: 'demo' })
    assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error.issues, null, 2))
  })
})
