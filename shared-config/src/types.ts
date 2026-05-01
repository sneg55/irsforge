import type { z } from 'zod'
import type {
  authSchema,
  builtinAuthSchema,
  cdsSchema,
  configSchema,
  csaSchema,
  currencyCurveSchema,
  curvesSchema,
  damlSchema,
  demoCdsStubSchema,
  demoCsaSchema,
  demoSchema,
  eligibleCollateralSchema,
  floatingRateIndexSchema,
  floatingRateIndicesSchema,
  ledgerSchema,
  masterAgreementSchema,
  observablesSchema,
  oidcAuthSchema,
  orgSchema,
  platformSchema,
  scheduleDefaultsEntrySchema,
  scheduleDefaultsSchema,
} from './schema.js'
import type { ledgerUiSchema } from './schema-ledger-ui.js'

export type Config = z.infer<typeof configSchema>
export type Org = z.infer<typeof orgSchema>
export type Auth = z.infer<typeof authSchema>
export type BuiltinAuth = z.infer<typeof builtinAuthSchema>
export type OidcAuth = z.infer<typeof oidcAuthSchema>
export type Daml = z.infer<typeof damlSchema>
export type Platform = z.infer<typeof platformSchema>
export type Ledger = z.infer<typeof ledgerSchema>
export type Cds = z.infer<typeof cdsSchema>
export type Observables = z.infer<typeof observablesSchema>
export type ScheduleDefaults = z.infer<typeof scheduleDefaultsSchema>
export type ScheduleDefaultsEntry = z.infer<typeof scheduleDefaultsEntrySchema>
export type Demo = z.infer<typeof demoSchema>
export type DemoCdsStub = z.infer<typeof demoCdsStubSchema>
export type Csa = z.infer<typeof csaSchema>
export type EligibleCollateral = z.infer<typeof eligibleCollateralSchema>
export type DemoCsa = z.infer<typeof demoCsaSchema>
export type MasterAgreement = z.infer<typeof masterAgreementSchema>
export type Curves = z.infer<typeof curvesSchema>
export type CurrencyCurve = z.infer<typeof currencyCurveSchema>
export type FloatingRateIndices = z.infer<typeof floatingRateIndicesSchema>
export type FloatingRateIndexConfig = z.infer<typeof floatingRateIndexSchema>
export type Profile = Config['profile']

export type Topology = Config['topology']
export type Routing = Config['routing']
export type AuthProvider = Auth['provider']
export type LedgerUi = z.infer<typeof ledgerUiSchema>
