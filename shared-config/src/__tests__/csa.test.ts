import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generateDamlConfig } from '../codegen.js'
import { configSchema } from '../schema.js'
import { VALID_ORGS } from './_helpers.js'

const baseConfig = {
  topology: 'sandbox',
  auth: { provider: 'demo' },
  oracle: { url: 'http://localhost:3001' },
  platform: {
    authPublicUrl: 'http://localhost:3002',
    frontendUrl: 'http://localhost:3000',
  },
  currencies: [
    { code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true },
    { code: 'EUR', label: 'Euro', calendarId: 'EUR', isDefault: false },
  ],
  orgs: VALID_ORGS,
}

const validCsa = {
  threshold: { DirA: 0, DirB: 0 },
  mta: 100000,
  rounding: 10000,
  valuationCcy: 'USD',
  eligibleCollateral: [
    { currency: 'USD', haircut: 1.0 },
    { currency: 'EUR', haircut: 1.0 },
  ],
}

describe('csa schema', () => {
  it('parses the demo CSA block + demo.csa.initialFunding', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      profile: 'demo',
      csa: validCsa,
      demo: { csa: { initialFunding: { USD: 5000000 } } },
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.csa.mta, 100000)
      assert.equal(result.data.csa.rounding, 10000)
      assert.equal(result.data.csa.valuationCcy, 'USD')
      assert.equal(result.data.csa.eligibleCollateral.length, 2)
      assert.equal(result.data.demo?.csa?.initialFunding['USD'], 5000000)
    }
  })

  it('requires the csa block at top level', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      profile: 'demo',
    })
    assert.equal(result.success, false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'csa')
      assert.ok(issue, 'expected missing csa issue')
    }
  })

  it('rejects haircut > 1', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      csa: {
        ...validCsa,
        eligibleCollateral: [{ currency: 'USD', haircut: 1.5 }],
      },
    })
    assert.equal(result.success, false)
  })

  it('rejects empty eligibleCollateral', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      csa: { ...validCsa, eligibleCollateral: [] },
    })
    assert.equal(result.success, false)
  })

  it('rejects negative threshold', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      csa: { ...validCsa, threshold: { DirA: -1, DirB: 0 } },
    })
    assert.equal(result.success, false)
  })

  it('rejects negative mta', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      csa: { ...validCsa, mta: -1 },
    })
    assert.equal(result.success, false)
  })

  it('rejects valuationCcy with wrong length', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      csa: { ...validCsa, valuationCcy: 'USDX' },
    })
    assert.equal(result.success, false)
  })

  it('rejects profile=production carrying populated demo.csa', () => {
    const result = configSchema.safeParse({
      ...baseConfig,
      profile: 'production',
      csa: validCsa,
      demo: { csa: { initialFunding: { USD: 1 } } },
    })
    assert.equal(result.success, false)
  })
})

describe('csa codegen', () => {
  it('emits all csa* constants into Daml output', () => {
    const out = generateDamlConfig({
      currencies: [{ code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true }],
      cdsReferenceNames: [],
      scheduleDefaults: {},
      csa: {
        thresholdDirA: 0,
        thresholdDirB: 0,
        mta: 100000,
        rounding: 10000,
        valuationCcy: 'USD',
        eligibleCollateral: [
          { currency: 'USD', haircut: 1.0 },
          { currency: 'EUR', haircut: 1.0 },
        ],
      },
      demoCsaInitialFunding: { USD: 5000000 },
      schedulerPartyHint: 'Scheduler',
      operatorPolicy: {},
    })
    assert.ok(out.includes('csaThresholdDirA : Decimal'))
    assert.ok(out.includes('csaThresholdDirA = 0.0'))
    assert.ok(out.includes('csaThresholdDirB : Decimal'))
    assert.ok(out.includes('csaThresholdDirB = 0.0'))
    assert.ok(out.includes('csaMta : Decimal'))
    assert.ok(out.includes('csaMta = 100000.0'))
    assert.ok(out.includes('csaRounding : Decimal'))
    assert.ok(out.includes('csaRounding = 10000.0'))
    assert.ok(out.includes('csaValuationCcy : Text'))
    assert.ok(out.includes('csaValuationCcy = "USD"'))
    assert.ok(out.includes('csaEligibleCollateral : [(Text, Decimal)]'))
    assert.ok(out.includes('("USD", 1.0)'))
    assert.ok(out.includes('("EUR", 1.0)'))
    assert.ok(out.includes('demoCsaInitialFunding : [(Text, Decimal)]'))
    assert.ok(out.includes('("USD", 5000000.0)'))
  })

  it('preserves haircut decimals — Phase 9 readiness', () => {
    const out = generateDamlConfig({
      currencies: [{ code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true }],
      cdsReferenceNames: [],
      scheduleDefaults: {},
      csa: {
        thresholdDirA: 0,
        thresholdDirB: 0,
        mta: 100000,
        rounding: 10000,
        valuationCcy: 'USD',
        eligibleCollateral: [{ currency: 'USD', haircut: 0.92 }],
      },
      demoCsaInitialFunding: { USD: 5000000 },
      schedulerPartyHint: 'Scheduler',
      operatorPolicy: {},
    })
    assert.match(out, /\("USD", 0\.92\)/) // NOT 0.9
  })

  it('emits demoCsaInitialFunding = [] when funding map is empty', () => {
    const out = generateDamlConfig({
      currencies: [{ code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true }],
      cdsReferenceNames: [],
      scheduleDefaults: {},
      csa: {
        thresholdDirA: 0,
        thresholdDirB: 0,
        mta: 0,
        rounding: 0,
        valuationCcy: 'USD',
        eligibleCollateral: [{ currency: 'USD', haircut: 1.0 }],
      },
      demoCsaInitialFunding: {},
      schedulerPartyHint: 'Scheduler',
      operatorPolicy: {},
    })
    assert.ok(out.includes('demoCsaInitialFunding : [(Text, Decimal)]'))
    assert.ok(out.includes('demoCsaInitialFunding = []'))
  })
})
