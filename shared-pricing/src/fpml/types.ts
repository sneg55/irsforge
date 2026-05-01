// FpML classifier types — XML-free.
//
// `ParsedFpml` is the lossless intermediate shape consumed by `classify`.
// Two upstream producers feed it:
//   1. `app/src/features/fpml-import/classify.ts::parseFpml` parses raw XML.
//   2. `oracle/src/services/mark-publisher/replay-decode-fpml.ts` reads the
//      already-parsed `swapStreams` field off the on-chain
//      `Daml.Finance.Instrument.Swap.V0.Fpml.Instrument` template.
// Both produce the same `ParsedFpml` shape and feed it through `classify`.

export type ParsedRateType = 'fixed' | 'float'

export type FpmlCompounding =
  | 'Flat'
  | 'None'
  | 'Straight'
  | 'CompoundedInArrears'
  | 'OvernightAverage'

export interface ParsedLeg {
  currency: string
  notional: number
  rateType: ParsedRateType
  /** Populated when rateType === 'fixed'. */
  fixedRate?: number
  /** Populated when rateType === 'float'. */
  indexId?: string
  /** Float-leg spread (absolute decimal, e.g. 0.0025 for 25bp). */
  spread?: number
  /** Float-leg compounding model. Drives OIS vs vanilla IRS classification. */
  compounding?: FpmlCompounding
  /** FpML dayCountFraction tag verbatim (e.g. "ACT/360"). Consumer normalises. */
  dayCountFraction: string
  /**
   * FpML payerPartyReference href, when present in the XML. Positional party
   * markers: 'party1' = partyA (trade owner), 'party2' = counterparty.
   * Absent for legacy XML that omits these tags.
   */
  payerPartyRef?: string
}

export interface ParsedFpml {
  legs: ParsedLeg[]
  effectiveDate: Date
  terminationDate: Date
}

export type SupportedProduct = 'IRS' | 'OIS' | 'BASIS' | 'XCCY'

export type Classification =
  | { productType: 'IRS' | 'OIS'; fixedLeg: ParsedLeg; floatLeg: ParsedLeg }
  | { productType: 'BASIS'; legA: ParsedLeg; legB: ParsedLeg }
  | { productType: 'XCCY'; fixedLeg: ParsedLeg; floatLeg: ParsedLeg }
  | { productType: null; reason: string }
