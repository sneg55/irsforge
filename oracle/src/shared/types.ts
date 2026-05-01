// Node-side twin of app/src/shared/ledger/csa-types.ts.
// Kept local so oracle/ doesn't depend on app/. Canton's JSON API v1
// returns Daml `Map k v` as `[[k, v], ...]`, NOT an object — every Map
// here is typed as the array-of-tuples form (feedback_canton_json_api_v1_maps.md).

export type DamlMap<K extends string, V> = [K, V][]
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
// with the `EligibleCollateralPayload` type below.
export type DisputeReason =
  | 'Valuation'
  | 'Collateral'
  | 'FxRate'
  | 'Threshold'
  | 'IndependentAmount'
  | 'Other'

export interface EligibleCollateralPayload {
  currency: string
  haircut: string
}

export interface CsaPayload {
  operator: string
  partyA: string
  partyB: string
  regulators: string[]
  scheduler: string
  threshold: DamlMap<CsaDirection, string>
  mta: string
  rounding: string
  eligible: EligibleCollateralPayload[]
  valuationCcy: string
  // Signed Credit Support Balance per currency. Positive = A has pledged
  // toward B; negative = B has pledged toward A. Replaces the prior
  // `postedByA`/`postedByB` pool representation.
  csb: DamlMap<string, string>
  state: CsaState
  lastMarkCid: string | null
  // Pointer to the open `DisputeRecord` (Csa.Dispute:DisputeRecord) when
  // `state ∈ {MarkDisputed, Escalated}`; null otherwise.
  activeDispute: string | null
  isdaMasterAgreementRef: string
  governingLaw: GoverningLaw
  imAmount: string
}

export interface MarkToMarketPayload {
  operator: string
  partyA: string
  partyB: string
  regulators: string[]
  scheduler: string
  csaCid: string
  asOf: string
  exposure: string
  snapshot: string
}

export interface InstrumentKey {
  depository: string
  issuer: string
  id: { unpack: string }
  version: string
  holdingStandard: string
}

export interface SwapWorkflow {
  swapType: string
  operator: string
  partyA: string
  partyB: string
  regulators: string[]
  scheduler: string
  instrumentKey: InstrumentKey
  notional: string
}

export interface SchedulerRolePayload {
  operator: string
  scheduler: string
  regulators: string[]
}

export interface NettedBatchPayload {
  operator: string
  partyA: string
  partyB: string
  regulators: string[]
  scheduler: string
  csaCid: string
  paymentTimestamp: string
  netByCcy: [string, string][]
  settledEffects: string[]
  batchCid: string | null
}
