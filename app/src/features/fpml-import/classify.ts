import { XMLParser } from 'fast-xml-parser'
import type { FpmlCompounding, ParsedFpml, ParsedLeg } from './types'

// `classify` lives in @irsforge/shared-pricing/fpml — re-exported here so
// existing call sites (`import { parseFpml, classify } from './classify'`)
// keep working without churn. The oracle replay path consumes the same
// classifier directly from shared-pricing.
export { classify } from '@irsforge/shared-pricing'

/**
 * Parse a minimal FpML fragment into the ParsedFpml shape. We intentionally
 * only consume the subset of 5.12 fields the taxonomy depends on — drilling
 * every swapStream for currency, notional, fixed/floating rate, spread,
 * compounding, and day-count. Anything else (business-day adjustments,
 * calendars, reset schedules) is ignored; an on-chain swap is 24/7 and
 * doesn't need them (see memory/feedback_onchain_247_no_bdc).
 */
export function parseFpml(xml: string): ParsedFpml {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  })
  const doc = asRecord(parser.parse(xml) as unknown)

  const fpml = asRecord(doc['FpML'] ?? doc['fpml:FpML'])
  if (Object.keys(fpml).length === 0) throw new Error('FpML: missing <FpML> root')
  const trade = asRecord(fpml['trade'])
  if (Object.keys(trade).length === 0) throw new Error('FpML: missing <trade>')
  const swap = asRecord(trade['swap'])
  if (Object.keys(swap).length === 0) throw new Error('FpML: missing <swap>')

  const streamsRaw = swap['swapStream']
  const streams: unknown[] = Array.isArray(streamsRaw) ? streamsRaw : streamsRaw ? [streamsRaw] : []
  if (streams.length === 0) throw new Error('FpML: no <swapStream> found')

  const legs = streams.map(parseLeg)

  // Effective/termination come off the first swapStream — FpML requires every
  // stream on a swap to share start/end; we read leg-0 and trust it.
  const leg0 = streams[0] as Record<string, unknown>
  const dates = extractDates(leg0)

  return { legs, effectiveDate: dates.effective, terminationDate: dates.termination }
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return {}
}

function asText(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return undefined
}

function parseLeg(rawStream: unknown): ParsedLeg {
  const stream = asRecord(rawStream)
  const periodAmount = asRecord(stream.calculationPeriodAmount)
  const calc = asRecord(periodAmount.calculation)

  const notionalSchedule = asRecord(calc.notionalSchedule)
  const step = asRecord(notionalSchedule.notionalStepSchedule)
  const initialValueText = asText(step.initialValue)
  if (initialValueText === undefined) throw new Error('FpML leg: missing notional initialValue')
  const notional = Number(initialValueText)

  const currency = asText(step.currency)
  if (!currency) throw new Error('FpML leg: missing notional currency')

  const dayCountFraction = asText(calc.dayCountFraction) ?? 'ACT/360'

  // Extract payerPartyReference href if present (positional party markers:
  // 'party1' = partyA/owner, 'party2' = counterparty).
  const payerRef = asRecord(stream.payerPartyReference)
  const payerPartyRef = asText(payerRef['@_href']) ?? undefined

  const fixedSchedule = asRecord(calc.fixedRateSchedule)
  const fixedInitial = asText(fixedSchedule.initialValue)

  if (fixedInitial !== undefined) {
    return {
      currency,
      notional,
      rateType: 'fixed',
      fixedRate: Number(fixedInitial),
      dayCountFraction,
      payerPartyRef,
    }
  }

  const floatCalc = asRecord(calc.floatingRateCalculation)
  const indexId = asText(floatCalc.floatingRateIndex)
  if (!indexId) throw new Error('FpML leg: neither fixed nor floating rate present')

  const spreadSchedule = asRecord(floatCalc.spreadSchedule)
  const spreadText = asText(spreadSchedule.initialValue)
  const spread = spreadText !== undefined ? Number(spreadText) : 0

  const compoundingText = asText(floatCalc.compoundingMethod)
  const compounding = isFpmlCompounding(compoundingText) ? compoundingText : undefined

  return {
    currency,
    notional,
    rateType: 'float',
    indexId,
    spread,
    compounding,
    dayCountFraction,
    payerPartyRef,
  }
}

function extractDates(stream: Record<string, unknown>): { effective: Date; termination: Date } {
  const dates = asRecord(stream.calculationPeriodDates)
  const eff = asRecord(dates.effectiveDate)
  const term = asRecord(dates.terminationDate)
  const effText = asText(eff.unadjustedDate)
  const termText = asText(term.unadjustedDate)
  if (!effText) throw new Error('FpML: missing effectiveDate/unadjustedDate')
  if (!termText) throw new Error('FpML: missing terminationDate/unadjustedDate')
  return { effective: new Date(effText), termination: new Date(termText) }
}

function isFpmlCompounding(v: string | undefined): v is FpmlCompounding {
  return (
    v === 'Flat' ||
    v === 'None' ||
    v === 'Straight' ||
    v === 'CompoundedInArrears' ||
    v === 'OvernightAverage'
  )
}
