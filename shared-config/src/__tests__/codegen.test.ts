import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { generateDamlConfig } from '../codegen.js'

describe('generateDamlConfig', () => {
  const config = {
    currencies: [
      { code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true },
      { code: 'EUR', label: 'Euro', calendarId: 'EUR', isDefault: false },
    ],
    cdsReferenceNames: ['TSLA'],
    scheduleDefaults: {
      IRS: { frequencyMonths: 3, dayCountConvention: 'Act360' as const },
      OIS: { frequencyMonths: 12, dayCountConvention: 'Act360' as const },
    },
    csa: {
      thresholdDirA: 0,
      thresholdDirB: 0,
      mta: 100000,
      rounding: 10000,
      valuationCcy: 'USD',
      eligibleCollateral: [{ currency: 'USD', haircut: 1.0 }],
    },
    demoCsaInitialFunding: { USD: 5000000 },
    schedulerPartyHint: 'Scheduler',
    operatorPolicy: {
      IRS: 'auto' as const,
      OIS: 'auto' as const,
      BASIS: 'auto' as const,
      XCCY: 'auto' as const,
      CDS: 'manual' as const,
      CCY: 'auto' as const,
      FX: 'auto' as const,
      ASSET: 'auto' as const,
      FpML: 'auto' as const,
    },
  }

  it('emits a module header', () => {
    const out = generateDamlConfig(config)
    assert.match(out, /^module Setup\.GeneratedConfig where$/m)
  })

  it('emits CurrencyDef for each currency', () => {
    const out = generateDamlConfig(config)
    assert.ok(
      out.includes('CurrencyDef with code = "USD"; label = "US Dollar"; calendarId = "USD"'),
    )
    assert.ok(out.includes('CurrencyDef with code = "EUR"; label = "Euro"; calendarId = "EUR"'))
  })

  it('emits defaultCurrencyCode', () => {
    const out = generateDamlConfig(config)
    assert.ok(out.includes('defaultCurrencyCode : Text'))
    assert.ok(out.includes('defaultCurrencyCode = "USD"'))
  })

  it('emits cdsReferenceNames', () => {
    const out = generateDamlConfig(config)
    assert.ok(out.includes('cdsReferenceNames = ["TSLA"]'))
  })

  it('emits ScheduleDefaultsDef record + scheduleDefaultsEntries list', () => {
    const out = generateDamlConfig(config)
    assert.ok(out.includes('data ScheduleDefaultsDef = ScheduleDefaultsDef'))
    assert.ok(out.includes('frequencyMonths    : Int'))
    assert.ok(out.includes('dayCountConvention : DayCountConventionEnum'))
    assert.ok(out.includes('scheduleDefaultsEntries : [(Text, ScheduleDefaultsDef)]'))
    assert.ok(
      out.includes(
        '("IRS", ScheduleDefaultsDef with frequencyMonths = 3; dayCountConvention = Act360)',
      ),
    )
    assert.ok(
      out.includes(
        '("OIS", ScheduleDefaultsDef with frequencyMonths = 12; dayCountConvention = Act360)',
      ),
    )
  })

  it('emits schedulerPartyHint', () => {
    const out = generateDamlConfig(config)
    assert.ok(out.includes('schedulerPartyHint : Text'))
    assert.ok(out.includes('schedulerPartyHint = "Scheduler"'))
  })

  it('emits custom schedulerPartyHint values verbatim', () => {
    const out = generateDamlConfig({ ...config, schedulerPartyHint: 'sched-prod' })
    assert.ok(out.includes('schedulerPartyHint = "sched-prod"'))
  })

  it('throws when zero defaults present', () => {
    assert.throws(
      () =>
        generateDamlConfig({
          currencies: [{ code: 'USD', label: 'U', calendarId: 'U', isDefault: false }],
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
        }),
      /default/,
    )
  })

  it('emits operatorPolicySeeds keyed by family', () => {
    const out = generateDamlConfig(config)
    assert.ok(out.includes('import Operator.Policy (PolicyMode(..))'))
    assert.ok(out.includes('operatorPolicySeeds : [(Text, PolicyMode)]'))
    // Sorted alphabetically — CDS lands before IRS.
    assert.ok(out.includes('("CDS", Manual)'))
    assert.ok(out.includes('("IRS", Auto)'))
  })
})
