import type {
  CashflowEntry,
  LegConfig,
  LegDirection,
  SwapConfig,
  SwapType,
  ValuationResult,
} from '@irsforge/shared-pricing'

export type { CashflowEntry, LegConfig, LegDirection, SwapConfig, SwapType, ValuationResult }

export type WorkspaceMode = 'draft' | 'active' | 'whatif'

export type SwapStatus = 'Proposed' | 'Active' | 'PendingSettlement' | 'Matured' | 'Terminated'

export interface SwapTypeConfig {
  label: string
  shortLabel: string
  defaultLegs: LegConfig[]
  directionField: string // 'ownerReceivesFix' | 'ownerReceivesBase' | 'ownerReceivesRate'
  curveType: 'sofr' | 'dual' | 'hazard' | 'fx-forward' | 'asset'
  valuationMetrics: string[] // which metrics to show in right panel
}

export interface DraftSummary {
  draftId: string
  type: SwapType
  lastModified: number
  notional: number
}

// --- Status action routing ---

export type ActionTarget = 'proposal' | 'workflow' | 'terminateProposal'

/**
 * A button in the right-panel action list. `target` names the Daml contract
 * the choice is exercised on; `choice` is the generic UI key mapped to a
 * Daml choice name by the target-specific dispatcher.
 */
export type StatusAction =
  | {
      target: 'proposal'
      choice: 'accept' | 'reject' | 'withdraw'
      label: string
      variant: ActionVariant
    }
  | {
      target: 'workflow'
      choice: 'TriggerLifecycle' | 'Settle' | 'Terminate' | 'Mature'
      label: string
      variant: ActionVariant
      operatorOnly?: boolean
    }
  | {
      target: 'terminateProposal'
      choice: 'propose' | 'TpAccept' | 'TpReject' | 'TpWithdraw'
      label: string
      variant: ActionVariant
    }

export type ActionVariant = 'primary' | 'secondary' | 'ghost'

// --- Observables config (from /api/config) ---

/**
 * Mirrors the shape emitted by `/api/config` (task 26). The browser uses this
 * to resolve which `Observation` contracts a TriggerLifecycle exercise needs
 * to pass to the on-chain lifecycle rule, without hardcoding rate ids.
 *
 * IRS:  `rateIds` is the authoritative list of rate ids the lifecycle rule
 *       will look up (e.g. `["SOFR/ON"]`).
 * CDS:  `rateIdPattern` is a template string like `CDS/{refName}/{DefaultProb|Recovery}`.
 *       The per-swap rate IDs are read directly off the on-chain CDS instrument's
 *       `defaultProbabilityReferenceId` and `recoveryRateReferenceId` fields.
 * CCY/FX/FpML: no external observations (cashflows are self-contained).
 * ASSET: `rateIdPattern` is a template like `ASSET/{assetId}`. `enabled=false`
 *        means the oracle has not yet published these feeds — callers should
 *        skip the lifecycle call rather than query for non-existent contracts.
 */
export interface ObservablesConfig {
  IRS: { rateIds: string[]; kind: 'periodic-fixing'; enabled: boolean }
  // OIS consumes the same periodic-fixing rate ids as IRS; a dedicated
  // entry lets the /api/config route toggle OIS visibility independently.
  OIS: { rateIds: string[]; kind: 'periodic-fixing'; enabled: boolean }
  // BASIS/XCCY ship dormant in Stage C (Stages D/E flip them on).
  BASIS: { rateIds: string[]; kind: 'periodic-fixing'; enabled: boolean }
  XCCY: { rateIds: string[]; kind: 'periodic-fixing'; enabled: boolean }
  CDS: { rateIdPattern: string; kind: 'credit-event'; enabled: boolean }
  CCY: { rateIds: string[]; kind: 'none'; enabled: boolean }
  FX: { rateIds: string[]; kind: 'none'; enabled: boolean }
  ASSET: { rateIdPattern: string; kind: 'price'; enabled: boolean }
  FpML: { rateIds: string[]; kind: 'embedded'; enabled: boolean }
}
