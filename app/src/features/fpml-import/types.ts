/**
 * Phase 3 Stage F — FpML Import types.
 *
 * `ParsedFpml` is the lossless intermediate shape `parseFpml` emits. `Classify`
 * walks it once to pick which typed product the imported XML represents, then
 * `buildProposalFromClassification` promotes the classification into the
 * canonical `TypedProposal` shape shared with the export path — the round-trip
 * contract is that `classify + build ∘ export` is the identity on `TypedProposal`
 * for every supported product.
 *
 * Dates live as ISO-8601 strings (YYYY-MM-DD) on `TypedProposal` payloads so
 * JSON round-trip via URL hand-off stays structural-equal; `parseFpml` preserves
 * the Date shape upstream because the classifier never serialises — import→state
 * conversion happens in `buildProposalFromClassification`.
 */

// Classifier types live in @irsforge/shared-pricing/fpml — re-exported
// here so existing call sites keep working without churn. The oracle
// replay path imports them from shared-pricing directly.
export type {
  Classification,
  FpmlCompounding,
  ParsedFpml,
  ParsedLeg,
  ParsedRateType,
  SupportedProduct,
} from '@irsforge/shared-pricing'

/**
 * Canonical typed payloads used by BOTH import and export. Every field is
 * serialisable JSON so `JSON.parse(JSON.stringify(payload))` is structural-
 * equal to the original — this is the round-trip anchor.
 *
 * `dayCount` uses the Daml-side convention string (`Act360`, `Act365Fixed`,
 * `Basis30360`) to match `build-proposal-payload.ts`. The XML builder maps
 * back to ISO day-count fractions (`ACT/360`, etc.) when emitting.
 *
 * Direction fields:
 * - `IrsLikePayload.fixedDirection` — which side (partyA = owner) pays the
 *   fixed leg. Float direction is always the opposite. Defaults to `'receive'`
 *   (owner receives fixed, pays float) when absent in legacy XML.
 * - `BasisPayload.leg0Direction` — which side pays leg-0 (leg-1 is opposite).
 *   Defaults to `'pay'` when absent in legacy XML.
 * - `XccyPayload.fixedDirection` — same semantics as IrsLikePayload.
 *   Defaults to `'receive'` when absent in legacy XML.
 */
export interface IrsLikePayload {
  notional: number
  currency: string
  fixRate: number
  floatingRateId: string
  floatingSpread: number
  startDate: string
  maturityDate: string
  dayCount: string
  /** Which side (partyA = owner) pays the fixed leg. Default: 'receive'. */
  fixedDirection: 'pay' | 'receive'
}

export interface BasisPayload {
  notional: number
  currency: string
  leg0IndexId: string
  leg1IndexId: string
  leg0Spread: number
  leg1Spread: number
  startDate: string
  maturityDate: string
  dayCount: string
  /** Which side (partyA = owner) pays leg-0. Leg-1 direction is opposite. Default: 'pay'. */
  leg0Direction: 'pay' | 'receive'
}

export interface XccyPayload {
  fixedCurrency: string
  fixedNotional: number
  fixedRate: number
  floatCurrency: string
  floatNotional: number
  floatIndexId: string
  floatSpread: number
  startDate: string
  maturityDate: string
  dayCount: string
  /** Which side (partyA = owner) pays the fixed leg. Default: 'receive'. */
  fixedDirection: 'pay' | 'receive'
}

export type TypedProposal =
  | { type: 'IRS'; payload: IrsLikePayload }
  | { type: 'OIS'; payload: IrsLikePayload }
  | { type: 'BASIS'; payload: BasisPayload }
  | { type: 'XCCY'; payload: XccyPayload }
