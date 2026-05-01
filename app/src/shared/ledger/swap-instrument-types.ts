/**
 * Per-family on-chain instrument payload types. Phase 2 makes the Daml Finance
 * instrument the source of truth for swap economics; the frontend reads these
 * shapes via `useSwapInstruments` (see `app/src/shared/hooks/use-swap-instruments.ts`)
 * and feeds them into the pricer, blotter mappers, and lifecycle resolver. Field
 * names mirror the Daml `template Instrument` records (NOT the per-family `Types`
 * data records) verbatim — JSON API returns them in template-shape.
 *
 * IMPORTANT: The Daml Finance V0 swap-instrument templates flatten the
 * InstrumentKey fields (`depository`, `issuer`, `id`, `version`, `holdingStandard`)
 * as top-level template fields rather than wrapping them in an `instrument: InstrumentKey`
 * record. Use `payload.id.unpack` (NOT `payload.instrument.id.unpack`) when keying
 * by instrument id. The per-family `Types.X` data records DO have `instrument :
 * InstrumentKey`, but those are the *creation arguments* the proposals build, not
 * what the JSON API returns from a /v1/query against the `Instrument` template.
 *
 * Note: Each Daml template also carries `holidayCalendarIds`, `calendarDataProvider`,
 * `observers`, and `lastEventTimestamp` — those fields are intentionally excluded
 * here because no pricer / mapper in Phase 2 consumes them. Phase 3 widens these
 * interfaces if the SOFR coupon model or scheduling logic needs them.
 *
 * Decimals → string (JSON API serialises Daml Decimal as a JSON string).
 * Dates    → string (ISO-8601 date string, e.g. "2026-04-16").
 * Optional → T | null.
 */

import type { FpmlSwapStreamPayload } from '@irsforge/shared-pricing'
import type { InstrumentKey } from './types'

/**
 * Common flattened-InstrumentKey fields shared by every per-family swap
 * instrument template.
 */
export interface FlatInstrumentKeyFields {
  depository: string
  issuer: string
  id: { unpack: string }
  version: string
  holdingStandard: string
}

// ---------------------------------------------------------------------------
// Shared sub-shapes
// ---------------------------------------------------------------------------

/**
 * Subset of PeriodicSchedule fields the frontend pricer / mappers need.
 * Daml's full PeriodicSchedule also carries `frequency`, `businessDayAdjustment`,
 * `effectiveDateBusinessDayAdjustment`, `terminationDateBusinessDayAdjustment`,
 * and `stubPeriodType` — omitted here. Phase 3 (SOFR + bootstrap) will widen
 * this if needed.
 *
 * Source: Daml.Finance.Interface.Types.Date.V3.Schedule.PeriodicSchedule
 */
export interface PeriodicSchedulePayload {
  effectiveDate: string
  terminationDate: string
  firstRegularPeriodStartDate: string | null
  lastRegularPeriodEndDate: string | null
}

/**
 * Stripped to the rate identifier only.
 * Daml's full FloatingRate also carries `referenceRateType` (a variant enum)
 * and `fixingDates` (a DateOffset record) — omitted here. Phase 3 widens this.
 *
 * Source: Daml.Finance.Interface.Instrument.Types.V2.FloatingRate.FloatingRate
 */
export interface FloatingRatePayload {
  referenceRateId: string
}

// ---------------------------------------------------------------------------
// Per-family instrument payload interfaces
// ---------------------------------------------------------------------------

/**
 * IRS: Daml.Finance.Interface.Instrument.Swap.V0.InterestRate.Types.InterestRate
 */
export interface IrsInstrumentPayload extends FlatInstrumentKeyFields {
  description: string
  floatingRate: FloatingRatePayload
  ownerReceivesFix: boolean
  fixRate: string
  periodicSchedule: PeriodicSchedulePayload
  dayCountConvention: string
  currency: InstrumentKey
}

/**
 * CDS: Daml.Finance.Interface.Instrument.Swap.V0.CreditDefault.Types.CreditDefault
 */
export interface CdsInstrumentPayload extends FlatInstrumentKeyFields {
  description: string
  defaultProbabilityReferenceId: string
  recoveryRateReferenceId: string
  ownerReceivesFix: boolean
  fixRate: string
  periodicSchedule: PeriodicSchedulePayload
  dayCountConvention: string
  currency: InstrumentKey
}

/**
 * CCY: Daml.Finance.Interface.Instrument.Swap.V0.Currency.Types.CurrencySwap
 */
export interface CcyInstrumentPayload extends FlatInstrumentKeyFields {
  description: string
  ownerReceivesBase: boolean
  baseRate: string
  foreignRate: string
  periodicSchedule: PeriodicSchedulePayload
  dayCountConvention: string
  baseCurrency: InstrumentKey
  foreignCurrency: InstrumentKey
  fxRate: string
}

/**
 * FX: Daml.Finance.Interface.Instrument.Swap.V0.ForeignExchange.Types.ForeignExchange
 * No periodic schedule — only first/final exchange dates.
 */
export interface FxInstrumentPayload extends FlatInstrumentKeyFields {
  description: string
  firstFxRate: string
  finalFxRate: string
  issueDate: string
  firstPaymentDate: string
  maturityDate: string
  baseCurrency: InstrumentKey
  foreignCurrency: InstrumentKey
}

/**
 * Asset swap underlying basket entry.
 * Source: Daml.Finance.Interface.Instrument.Swap.V0.Asset.Types.Underlying
 */
export interface AssetUnderlyingPayload {
  referenceAsset: InstrumentKey
  referenceAssetId: string
  weight: string
  initialPrice: string
}

/**
 * Asset: Daml.Finance.Interface.Instrument.Swap.V0.Asset.Types.Asset
 */
export interface AssetInstrumentPayload extends FlatInstrumentKeyFields {
  description: string
  underlyings: AssetUnderlyingPayload[]
  ownerReceivesRate: boolean
  floatingRate: FloatingRatePayload | null
  fixRate: string
  periodicSchedule: PeriodicSchedulePayload
  dayCountConvention: string
  currency: InstrumentKey
}

/**
 * FpML: Daml.Finance.Interface.Instrument.Swap.V0.Fpml.Types.Fpml
 * (Also carries `calendarDataProvider : Party` — excluded; no Phase-2 consumer.)
 */
export interface FpmlInstrumentPayload extends FlatInstrumentKeyFields {
  description: string
  swapStreams: FpmlSwapStreamPayload[]
  issuerPartyRef: string
  currencies: InstrumentKey[]
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

/**
 * Discriminated union over every swap family. Families that share a physical
 * template also share a payload shape:
 *   - IRS + OIS              → InterestRate.Instrument    → IrsInstrumentPayload
 *   - BASIS + XCCY + FpML    → Fpml.Instrument            → FpmlInstrumentPayload
 * The discriminator `swapType` matches the string literals stored on
 * `SwapWorkflow.swapType` and the keys of `SWAP_INSTRUMENT_TEMPLATE_BY_TYPE`
 * (see template-ids.ts). Type narrowing via `instr.swapType === 'IRS'` (or any
 * alias) selects the matching payload type.
 */
export type SwapInstrumentPayload =
  | { swapType: 'IRS' | 'OIS'; payload: IrsInstrumentPayload }
  | { swapType: 'CDS'; payload: CdsInstrumentPayload }
  | { swapType: 'CCY'; payload: CcyInstrumentPayload }
  | { swapType: 'FX'; payload: FxInstrumentPayload }
  | { swapType: 'ASSET'; payload: AssetInstrumentPayload }
  | { swapType: 'BASIS' | 'XCCY' | 'FpML'; payload: FpmlInstrumentPayload }
