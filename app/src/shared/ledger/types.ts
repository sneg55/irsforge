// All six *Proposal templates are `signatory proposer, operator` (task 7 —
// operator must authorize Factory.Create during Accept). The TS shapes
// mirror the on-chain payload: `operator` is a plain Party field alongside
// proposer / counterparty.

export interface SwapProposal {
  proposer: string
  counterparty: string
  operator: string
  notional: string
  fixRate: string
  tenor: string
  startDate: string
  dayCountConvention: string
}

export interface OisProposal {
  proposer: string
  counterparty: string
  operator: string
  notional: string
  fixRate: string
  startDate: string
  maturityDate: string
  dayCountConvention: string
}

export interface BasisSwapProposal {
  proposer: string
  counterparty: string
  operator: string
  notional: string
  currency: string
  leg0Spread: string
  leg1Spread: string
  startDate: string
  maturityDate: string
  dayCountConvention: string
}

export interface CdsProposal {
  proposer: string
  counterparty: string
  operator: string
  notional: string
  fixRate: string
  // Reference name drawn from the configured CDS allowlist.
  // The on-chain CDS instrument carries the resulting per-CDS rate IDs
  // (`defaultProbabilityReferenceId` and `recoveryRateReferenceId`) directly;
  // resolveRateIdsForSwap reads them off the instrument rather than
  // re-deriving them from this name.
  referenceName: string
  ownerReceivesFix: boolean
  startDate: string
  maturityDate: string
  dayCountConvention: string
}

export interface CcySwapProposal {
  proposer: string
  counterparty: string
  operator: string
  notional: string
  baseRate: string
  foreignRate: string
  baseCurrency: string
  foreignCurrency: string
  fxRate: string
  ownerReceivesBase: boolean
  startDate: string
  maturityDate: string
  dayCountConvention: string
}

export interface FxSwapProposal {
  proposer: string
  counterparty: string
  operator: string
  notional: string
  baseCurrency: string
  foreignCurrency: string
  firstFxRate: string
  finalFxRate: string
  firstPaymentDate: string
  maturityDate: string
}

export interface AssetSwapProposal {
  proposer: string
  counterparty: string
  operator: string
  notional: string
  fixRate: string
  ownerReceivesRate: boolean
  underlyingAssetIds: string[]
  underlyingWeights: string[]
  startDate: string
  maturityDate: string
  dayCountConvention: string
}

export interface FpmlLegPayload {
  legType: string
  currency: string
  notional: string
  rate: string | null
  indexId: string | null
  spread: string | null
  dayCountConvention: string
}

export interface FpmlProposal {
  proposer: string
  counterparty: string
  operator: string
  legs: FpmlLegPayload[]
  startDate: string
  maturityDate: string
  description: string
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

export interface MaturedSwap {
  operator: string
  partyA: string
  partyB: string
  regulators: string[]
  scheduler: string
  swapType: string
  instrumentKey: InstrumentKey
  notional: string
  actualMaturityDate: string
  finalSettleBatchCid: string | null
  finalNetAmount: string
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

export interface TerminatedSwap {
  operator: string
  partyA: string
  partyB: string
  regulators: string[]
  swapType: string
  instrumentKey: InstrumentKey
  notional: string
  terminationDate: string
  agreedPvAmount: string
  reason: string
  terminatedByParty: string
  settleBatchCid: string | null
}

export interface InstrumentKey {
  depository: string
  issuer: string
  id: { unpack: string }
  version: string
  holdingStandard: string
}

export interface ContractResult<T> {
  contractId: string
  payload: T
}

export interface AccountKey {
  custodian: string
  owner: string
  id: { unpack: string }
}

/**
 * Registry of the six instrument factory cids created by Setup.Init — one
 * per swap family. Each Accept choice now calls `Factory.Create` on the
 * matching entry instead of cloning a shared `irsTemplateKey`.
 */
export interface FactoryRegistry {
  irs: string
  cds: string
  ccy: string
  fx: string
  asset: string
  fpml: string
}

/**
 * Per-currency schedule defaults captured at Setup.Init time so every
 * Accept path can look up the right calendar / roll / day-count without
 * asking the proposer. Keyed by currency code in the `scheduleDefaults`
 * Map (emitted by Canton's JSON API as a tuple-array, not an object).
 */
export interface ScheduleDefaults {
  frequencyMonths: number
  rollConvention: string
  dayCountConvention: string
  businessDayAdjustment: { calendarIds: string[]; convention: string }
}

/**
 * Snapshot of the platform-level infrastructure Setup.Init provisions —
 * cash instruments, the six instrument factories, lifecycle + settlement
 * scaffolding, and per-currency schedule defaults. Every swap workflow
 * reads from this record to resolve the factory / account / key it needs.
 *
 * IMPORTANT: Canton's JSON API v1 encodes `Map k v` as a tuple-array
 * `[[k, v], ...]`, NOT as an object. The `currencies` and
 * `scheduleDefaults` fields keep that shape — typing either as
 * `Record<string, T>` silently corrupts lookups (see memory:
 * `feedback_canton_json_api_v1_maps.md`).
 */
export interface CashSetupRecord {
  operator: string
  partyA: string
  partyB: string
  regulators: string[]
  lifecycleRuleCid: string
  eventFactoryCid: string
  settlementFactoryCid: string
  routeProviderCid: string
  partyAAccountKey: AccountKey
  partyBAccountKey: AccountKey
  currencies: [string, InstrumentKey][]
  defaultCurrencyCode: string
  factories: FactoryRegistry
  scheduleDefaults: [string, ScheduleDefaults][]
  cdsReferenceNames: string[]
}

/**
 * Helper: look up an instrument key by currency code in the tuple-array
 * `currencies` field. Returns `undefined` when the code isn't configured.
 */
export function findCurrencyKey(
  currencies: CashSetupRecord['currencies'],
  code: string,
): InstrumentKey | undefined {
  return currencies.find(([c]) => c === code)?.[1]
}

export interface FungibleHolding {
  instrument: InstrumentKey
  account: AccountKey
  amount: string
  lock: unknown
}

export interface Effect {
  provider: string
  targetInstrument: InstrumentKey
  producedQuantities: Array<{ unit: InstrumentKey; amount: string }>
  consumedQuantities: Array<{ unit: InstrumentKey; amount: string }>
  settlementDate: string
}

// Phase 5 Stage A — CSA / Mark / Shortfall payloads live in `csa-types.ts`
// (split out to keep this file under the 300-line limit). Re-export the
// public surface so downstream consumers can keep importing from
// `@/shared/ledger/types` without churn.
export type {
  CsaDirection,
  CsaPayload,
  CsaState,
  DamlMap,
  DisputeReason,
  DisputeRecordPayload,
  EligibleCollateralPayload,
  GoverningLaw,
  MarginShortfallPayload,
  MarkToMarketPayload,
} from './csa-types'
