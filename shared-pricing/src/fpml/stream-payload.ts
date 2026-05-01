// On-chain Fpml.SwapStream → ParsedFpml decoder. Two consumers share it:
//   1. oracle replay adapters (mark publisher + replay harness)
//   2. app blotter valuation (BASIS / XCCY rows)
//
// Pure; no ledger client, no React. Fixtures + builder helpers live
// alongside in this module.
//
// JSON encoding notes:
//   - Daml variants (`NotionalScheduleValue`, `RateTypeValue`) encode as
//     `{ "tag": "Constructor", "value": <payload> }` over the JSON API v1.
//   - Daml plain enums (`DayCountConventionEnum`, `CompoundingMethodEnum`)
//     encode as the constructor name string verbatim.
//   - Daml `Decimal` encodes as a JSON string (parseFloat'd here).

import type { ParsedFpml, ParsedLeg } from './types.js'

interface FixedRateScheduleJson {
  initialValue: string
}

interface SpreadScheduleJson {
  initialValue: string
}

interface FloatingRateCalculationJson {
  floatingRateIndex: string
  spreadSchedule: SpreadScheduleJson[]
}

type RateTypeValueJson =
  | { tag: 'RateType_Fixed'; value: FixedRateScheduleJson }
  | { tag: 'RateType_Floating'; value: FloatingRateCalculationJson }

interface NotionalStepScheduleJson {
  initialValue: string
  currency: string
}

interface NotionalScheduleJson {
  id: string
  notionalStepSchedule: NotionalStepScheduleJson
}

type NotionalScheduleValueJson =
  | { tag: 'NotionalSchedule_Regular'; value: NotionalScheduleJson }
  | { tag: 'NotionalSchedule_FxLinked'; value: unknown }

interface CalculationJson {
  notionalScheduleValue: NotionalScheduleValueJson
  rateTypeValue: RateTypeValueJson
  dayCountFraction: string
  compoundingMethodEnum: string | null
}

interface CalculationPeriodAmountJson {
  calculation: CalculationJson
}

interface AdjustableDateJson {
  unadjustedDate: string
}

interface CalculationPeriodDatesJson {
  effectiveDate: AdjustableDateJson
  terminationDate: AdjustableDateJson
}

export interface FpmlSwapStreamPayload {
  payerPartyReference: string
  receiverPartyReference: string
  calculationPeriodDates: CalculationPeriodDatesJson
  calculationPeriodAmount: CalculationPeriodAmountJson
}

export function streamToParsedLeg(stream: FpmlSwapStreamPayload): ParsedLeg {
  const calc = stream.calculationPeriodAmount.calculation

  if (calc.notionalScheduleValue.tag !== 'NotionalSchedule_Regular') {
    throw new Error(
      `streamToParsedLeg: ${calc.notionalScheduleValue.tag} not supported (regular notional only)`,
    )
  }
  const ns = calc.notionalScheduleValue.value.notionalStepSchedule
  const notional = parseFloat(ns.initialValue)
  const currency = ns.currency
  const dayCountFraction = calc.dayCountFraction

  if (calc.rateTypeValue.tag === 'RateType_Fixed') {
    return {
      currency,
      notional,
      rateType: 'fixed',
      fixedRate: parseFloat(calc.rateTypeValue.value.initialValue),
      dayCountFraction,
    }
  }
  // RateType_Floating
  const floating = calc.rateTypeValue.value
  const spreadInitial = floating.spreadSchedule[0]?.initialValue
  return {
    currency,
    notional,
    rateType: 'float',
    indexId: floating.floatingRateIndex,
    spread: spreadInitial !== undefined ? parseFloat(spreadInitial) : 0,
    // Stream-side compounding detection is unavailable (legToSwapStream
    // sets compoundingMethodEnum = None on every leg). IRS/OIS route
    // through InterestRate.Instrument (resolveIrsLike) anyway — leaving
    // `compounding` undefined here is correct for BASIS/XCCY/FpML paths.
    dayCountFraction,
  }
}

export function streamsToParsedFpml(streams: FpmlSwapStreamPayload[]): ParsedFpml {
  if (streams.length === 0) {
    throw new Error('streamsToParsedFpml: no swapStreams on instrument')
  }
  const legs = streams.map(streamToParsedLeg)
  const dates = streams[0].calculationPeriodDates
  return {
    legs,
    effectiveDate: new Date(dates.effectiveDate.unadjustedDate),
    terminationDate: new Date(dates.terminationDate.unadjustedDate),
  }
}
