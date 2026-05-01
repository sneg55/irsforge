import { z } from 'zod'
// Auth schemas live in a sibling file (schema-auth.ts) to keep schema.ts
// under the 300-line cap; re-exported here so existing import sites keep
// working.
import {
  authSchema,
  builtinAuthSchema,
  oidcAuthSchema,
  serviceAccountSchema,
} from './schema-auth.js'
// CSA schemas live in a sibling file to keep schema.ts under the 300-line cap;
// re-exported here so existing import sites (`from "./schema.js"`) keep working.
import {
  csaSchema,
  demoCsaSchema,
  eligibleCollateralSchema,
  masterAgreementSchema,
} from './schema-csa.js'
import { damlSchema, ledgerSchema } from './schema-daml.js'
import { demoCurveTickerSchema } from './schema-demo-curve-ticker.js'
import { demoResetSchema } from './schema-demo-reset.js'
import { ledgerUiSchema } from './schema-ledger-ui.js'
import { operatorSchema } from './schema-operator.js'
// Org schema (incl. the role enum) lives in a sibling file so adding a
// new role value only requires touching one place; re-exported here.
import { addOrgRoleIssues, orgRoleSchema, orgSchema } from './schema-orgs.js'
// Party-hint schemas live in a sibling file to keep schema.ts under the
// 300-line cap; re-exported so existing import sites keep working.
import { partiesSchema, partyHintSchema } from './schema-parties.js'
import { rateFamiliesSchema } from './schema-rate-families.js'
import { schedulerSchema } from './schema-scheduler.js'
import { addServiceAccountIssues } from './schema-service-accounts.js'

export {
  authSchema,
  builtinAuthSchema,
  oidcAuthSchema,
  orgRoleSchema,
  orgSchema,
  serviceAccountSchema,
}

export const oracleSchema = z.object({
  url: z.string().url(),
  ledgerTimeoutMs: z.number().int().positive().default(5000),
  fetchTimeoutMs: z.number().int().positive().default(5000),
})

export const platformSchema = z.object({
  authPublicUrl: z.string().url(),
  frontendUrl: z.string().url(),
  frontendUrlTemplate: z.string().url().optional(),
  ledgerUi: ledgerUiSchema,
  demoReset: demoResetSchema,
})

export const currencySchema = z.object({
  code: z.string().length(3),
  label: z.string().min(1),
  calendarId: z.string().min(1),
  isDefault: z.boolean().default(false),
})

export const cdsSchema = z.object({
  referenceNames: z.array(z.string().min(1)).min(1),
})

// Per-product enablement flag. The product list is closed (IRS/CDS/CCY/FX/ASSET/FpML);
// when a product is disabled the frontend hides it from the selector and the
// oracle refuses to register the corresponding provider. ASSET defaults to
// false because no real price-feed provider ships with the reference impl —
// promote the toggle once an oracle provider is designed (see Phase 1).
const observableFlag = z.object({ enabled: z.boolean() })

export const observablesSchema = z
  .object({
    IRS: observableFlag.default({ enabled: true }),
    OIS: observableFlag.default({ enabled: true }),
    BASIS: observableFlag.default({ enabled: false }),
    XCCY: observableFlag.default({ enabled: false }),
    CDS: observableFlag.default({ enabled: true }),
    CCY: observableFlag.default({ enabled: true }),
    FX: observableFlag.default({ enabled: true }),
    ASSET: observableFlag.default({ enabled: false }),
    FpML: observableFlag.default({ enabled: true }),
  })
  .default({})

// Per-product scheduling knobs read by each proposal's Accept body. Keep
// this surface small: only the fields that actually vary across products
// (frequencyMonths, dayCountConvention). rollConvention is overridden to
// match startDate's day-of-month at Accept time, and businessDayAdjustment
// is uniform across products today — both stay in InitImpl.daml as
// implementation defaults. Grow the YAML surface here when real variance
// emerges.
export const scheduleDefaultsEntrySchema = z.object({
  frequencyMonths: z.number().int().positive(),
  dayCountConvention: z.enum(['Act360', 'Act365F']).default('Act360'),
})

export const scheduleDefaultsSchema = z
  .object({
    IRS: scheduleDefaultsEntrySchema.default({ frequencyMonths: 3, dayCountConvention: 'Act360' }),
    OIS: scheduleDefaultsEntrySchema.default({ frequencyMonths: 12, dayCountConvention: 'Act360' }),
    BASIS: scheduleDefaultsEntrySchema.default({
      frequencyMonths: 3,
      dayCountConvention: 'Act360',
    }),
    XCCY: scheduleDefaultsEntrySchema.default({ frequencyMonths: 6, dayCountConvention: 'Act360' }),
    CDS: scheduleDefaultsEntrySchema.default({ frequencyMonths: 3, dayCountConvention: 'Act360' }),
    CCY: scheduleDefaultsEntrySchema.default({ frequencyMonths: 3, dayCountConvention: 'Act360' }),
    ASSET: scheduleDefaultsEntrySchema.default({
      frequencyMonths: 3,
      dayCountConvention: 'Act360',
    }),
    FPML: scheduleDefaultsEntrySchema.default({ frequencyMonths: 3, dayCountConvention: 'Act360' }),
  })
  .default({})

// Demo-only config. Every value here is a demo shortcut — when `profile`
// is "production" this block must be absent (the superRefine in configSchema
// enforces that). Grow this as more demo shortcuts need extraction from
// source (stub provider values, seed-swap parameters, etc.).
export const demoCdsStubSchema = z.object({
  defaultProb: z.number().min(0).max(1),
  recovery: z.number().min(0).max(1),
})

export const pillarSchema = z.object({
  tenorDays: z.number().int().positive(),
  zeroRate: z.number(),
})

export { csaSchema, demoCsaSchema, eligibleCollateralSchema, masterAgreementSchema }

export const curveProviderRefSchema = z.object({
  // Provider id matched at runtime against `oracle/src/providers/registry.ts`.
  // Lowercase + hyphenated to make the docs/concept of "registered id"
  // unambiguous in YAML.
  provider: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, {
      message: 'provider id must be lowercase alphanumeric with optional hyphens',
    }),
})

export const projectionCurveRefSchema = curveProviderRefSchema.extend({
  indexId: z.string().min(1),
})

export const currencyCurveSchema = z.object({
  dayCount: z.enum(['Act360', 'Act365F']),
  discount: curveProviderRefSchema,
  projection: projectionCurveRefSchema,
})

export const curvesSchema = z.object({
  interpolation: z.enum(['LinearZero', 'LogLinearDF']).default('LinearZero'),
  currencies: z.record(z.string().length(3), currencyCurveSchema),
})

export const floatingRateIndexSchema = z.object({
  currency: z.string().length(3),
  family: z.enum(['SOFR', 'ESTR', 'SONIA', 'TONA', 'SARON', 'TIIE', 'CORRA', 'BBSW', 'HONIA']),
  compounding: z.enum(['Simple', 'CompoundedInArrears', 'OvernightAverage']),
  lookback: z.number().int().min(0),
  floor: z.number().nullable(),
})

export const floatingRateIndicesSchema = z.record(z.string().min(1), floatingRateIndexSchema)

export const demoStubCurveSchema = z.object({
  discount: z.object({ pillars: z.array(pillarSchema).min(2) }),
  // projections keyed by indexId — one DiscountCurve per (ccy, indexId) pair
  projections: z.record(z.string().min(1), z.object({ pillars: z.array(pillarSchema).min(2) })),
})

export const demoStubCurvesSchema = z.record(z.string().length(3), demoStubCurveSchema)

// fxSpots seed FxSpot observable contracts on oracle startup. Key is the
// concatenated ISO currency-pair code (e.g. "EURUSD"); value is the rate
// expressed as units of quoteCcy per 1 unit of baseCcy. XCCY reporting-
// currency NPV translation reads these contracts from the ledger.
export const demoFxSpotsSchema = z.record(z.string().length(6), z.number().positive())

export const demoSchema = z.object({
  cdsStub: demoCdsStubSchema.optional(),
  stubCurves: demoStubCurvesSchema.optional(),
  fxSpots: demoFxSpotsSchema.optional(),
  csa: demoCsaSchema.optional(),
  curveTicker: demoCurveTickerSchema.optional(),
})

export type { RateFamiliesConfig, RateFamily, RateFamilyTenor } from './schema-rate-families.js'
export { rateFamiliesSchema } from './schema-rate-families.js'
export {
  damlSchema,
  demoCurveTickerSchema,
  ledgerSchema,
  operatorSchema,
  partiesSchema,
  partyHintSchema,
  schedulerSchema,
}

export const configSchema = z
  .object({
    profile: z.enum(['demo', 'production']).default('demo'),
    topology: z.enum(['sandbox', 'network']),
    routing: z.enum(['path', 'subdomain']).default('path'),
    auth: authSchema,
    oracle: oracleSchema,
    platform: platformSchema,
    daml: damlSchema,
    ledger: ledgerSchema,
    currencies: z.array(currencySchema).min(1),
    cds: cdsSchema.optional(),
    observables: observablesSchema,
    scheduleDefaults: scheduleDefaultsSchema,
    curves: curvesSchema.optional(),
    floatingRateIndices: floatingRateIndicesSchema.optional(),
    rateFamilies: rateFamiliesSchema.default({}),
    csa: csaSchema,
    masterAgreements: z.array(masterAgreementSchema).default([]),
    demo: demoSchema.optional(),
    orgs: z.array(orgSchema).min(1),
    parties: partiesSchema,
    scheduler: schedulerSchema.default({}),
    operator: operatorSchema,
  })
  .superRefine((config, ctx) => {
    if (config.routing === 'subdomain') {
      config.orgs.forEach((org, i) => {
        if (org.subdomain === undefined || org.subdomain === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['orgs', i, 'subdomain'],
            message: "subdomain is required for every org when routing is 'subdomain'",
          })
        }
      })
      if (config.platform.frontendUrlTemplate === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['platform', 'frontendUrlTemplate'],
          message: "frontendUrlTemplate is required when routing is 'subdomain'",
        })
      } else if (!config.platform.frontendUrlTemplate.includes('{subdomain}')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['platform', 'frontendUrlTemplate'],
          message: "frontendUrlTemplate must contain the literal token '{subdomain}'",
        })
      }
    }
    const defaults = config.currencies.filter((c) => c.isDefault)
    if (defaults.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currencies'],
        message: `exactly one currency must have isDefault: true (got ${defaults.length})`,
      })
    }
    const codes = new Set<string>()
    config.currencies.forEach((c, i) => {
      if (codes.has(c.code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['currencies', i, 'code'],
          message: `duplicate currency code: ${c.code}`,
        })
      }
      codes.add(c.code)
    })
    addOrgRoleIssues(config.orgs, ctx)
    // A production deployment must not carry a populated `demo:` subtree.
    // Empty-object is allowed so operators can flip `profile` back and forth
    // without deleting the block; anything populated is a hard error.
    if (config.profile === 'production' && config.demo) {
      const populated = Object.keys(config.demo).some(
        (k) => config.demo?.[k as keyof typeof config.demo] !== undefined,
      )
      if (populated) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['demo'],
          message: 'profile=production must not carry a populated `demo:` subtree',
        })
      }
    }
    addServiceAccountIssues(config, ctx)
  })
