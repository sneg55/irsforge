// Phase 5 Stage A — CSA / Mark / Shortfall payload types.
//
// Split out of `types.ts` to keep that file under the 300-line size limit.
// `types.ts` re-exports every name in this file so downstream consumers
// can continue importing from `@/shared/ledger/types`.

export interface EligibleCollateralPayload {
  currency: string
  haircut: string
}

// `Escalated` is the post-Dispute state where the operator has been
// invoked (via `EscalateDispute`) and now controls resolution.
// (`MarkDisputed` is the bilateral state where either party can still
// reach `AgreeToCounterMark`.)
export type CsaState = 'Active' | 'MarkDisputed' | 'MarginCallOutstanding' | 'Escalated'
export type CsaDirection = 'DirA' | 'DirB'
export type GoverningLaw = 'NewYork' | 'English' | 'Japanese'

// Categorical reason a dispute was opened. Mirrors the Daml-side
// `Csa.Types.DisputeReason` enum. Note the constructor was renamed
// `Collateral` (NOT `EligibleCollateral`) to avoid namespace collision
// with the `EligibleCollateralPayload` type above.
export type DisputeReason =
  | 'Valuation'
  | 'Collateral'
  | 'FxRate'
  | 'Threshold'
  | 'IndependentAmount'
  | 'Other'

// Per-dispute audit-trail contract created when a CSA dispute opens
// (`Dispute` choice) and archived on resolution (`AcknowledgeDispute`
// or `AgreeToCounterMark`). The originating Csa contract ID is stored
// as Text to avoid a mutual import between Csa.Csa and Csa.Dispute on
// the Daml side; consumers re-resolve via the JSON API as needed.
export interface DisputeRecordPayload {
  operator: string
  partyA: string
  partyB: string
  regulators: string[]
  scheduler: string
  csaCid: string
  disputer: string
  counterMark: string // decimal as string per Canton JSON API
  reason: DisputeReason
  notes: string
  openedAt: string // ISO-8601 UTC
}

// Canton JSON API v1 returns Daml `Map k v` as `[[k,v],...]`,
// NOT a JS object. Decoders must handle the array-of-tuples shape.
// (`feedback_canton_json_api_v1_maps.md`.)
export type DamlMap<K extends string, V> = [K, V][]

export interface CsaPayload {
  operator: string
  partyA: string
  partyB: string
  regulators: string[]
  scheduler: string
  threshold: DamlMap<CsaDirection, string> // decimal as string
  mta: string
  rounding: string
  eligible: EligibleCollateralPayload[]
  valuationCcy: string
  // Signed Credit Support Balance per currency. Positive = A has pledged
  // toward B (B is secured); negative = B has pledged toward A. Replaces
  // the prior `postedByA`/`postedByB` pool shape — see decode.ts for the
  // UI-facing derivation of `postedByA` / `postedByB` from this signed
  // balance.
  csb: DamlMap<string, string> // ccy → signed amount
  state: CsaState
  lastMarkCid: string | null
  // Pointer to the open `DisputeRecord` contract (Csa.Dispute:DisputeRecord)
  // when `state ∈ {MarkDisputed, Escalated}`; null otherwise. Set by the
  // `Dispute` choice, cleared by `AcknowledgeDispute` / `AgreeToCounterMark`.
  activeDispute: string | null
  // ISDA Master Agreement reference text (free-form; e.g. counterparty
  // legal-name + execution date). Stored as plain text on-chain for now.
  isdaMasterAgreementRef: string
  // Governing-law jurisdiction of the underlying ISDA Master Agreement.
  governingLaw: GoverningLaw
  // Initial Margin amount in the CSA's valuation currency. Observable-only
  // in v1: posting/withdraw flows operate on VM (csb), not IM.
  imAmount: string // decimal as string per Canton JSON API
}

export interface MarkToMarketPayload {
  operator: string
  partyA: string
  partyB: string
  regulators: string[]
  scheduler: string
  csaCid: string // stringified ContractId of the originating Csa
  asOf: string // ISO-8601 UTC
  exposure: string // signed decimal as string
  snapshot: string // JSON: { curveCids, indexCids, observationCutoff, swapCids }
}

export interface MarginShortfallPayload {
  operator: string
  csaCid: string // stringified ContractId
  debtor: string
  creditor: string
  currency: string
  deficit: string
  asOf: string
  relatedMark: string // stringified MarkToMarket ContractId
}
