// On-chain payload shapes consumed by the replay adapters. Mirror the
// shapes the app side reads via React Query in app/src/shared/ledger/use*.ts.

import type { CurveDayCount, InterpolationMethod } from '@irsforge/shared-pricing'

export interface SnapshotKey {
  curveCids: string[]
  indexCids: string[]
  observationCutoff: string
  swapCids: string[]
  // Phase 6 additions — present only when family-scope requires them.
  bookCurveCids?: string[] // XCCY: per-ccy CurveBook curve cids
  fxSpotCids?: string[] // XCCY
  cdsCurveCids?: string[] // CDS
}

export interface CurvePayload {
  currency: string
  curveType: 'Discount' | 'Projection'
  indexId: string | null
  asOf: string
  pillars: Array<{ tenorDays: string; zeroRate: string }>
  interpolation: InterpolationMethod
  dayCount: CurveDayCount
}

export interface IndexPayload {
  indexId: string
  currency: string
  family: string
  compounding: string
  lookback: string
  floor: string | null
}

export interface ObservationPayload {
  id: { unpack: string }
  observations: [string, string][]
}

export interface PeriodicSchedulePayload {
  effectiveDate: string
  terminationDate: string
  firstRegularPeriodStartDate: string | null
  lastRegularPeriodEndDate: string | null
}

export interface IrsInstrumentPayload {
  description: string
  floatingRate: { referenceRateId: string }
  ownerReceivesFix: boolean
  fixRate: string
  periodicSchedule: PeriodicSchedulePayload
  dayCountConvention: string
  id: { unpack: string }
}

// CDS: Daml.Finance.Instrument.Swap.V0.CreditDefault.Instrument template.
// Mirrors app/src/shared/ledger/swap-instrument-types.ts::CdsInstrumentPayload —
// V0 swap instruments flatten InstrumentKey to top-level fields per the
// `feedback_daml_finance_template_ids.md` memory + `swap-instrument-types.ts`
// header note.
export interface CdsInstrumentPayload {
  description: string
  defaultProbabilityReferenceId: string
  recoveryRateReferenceId: string
  ownerReceivesFix: boolean
  fixRate: string
  periodicSchedule: PeriodicSchedulePayload
  dayCountConvention: string
  id: { unpack: string }
}
