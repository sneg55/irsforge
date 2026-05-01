import {
  DAML_FINANCE_CLAIMS_PACKAGE_ID,
  DAML_FINANCE_DATA_PACKAGE_ID,
  DAML_FINANCE_HOLDING_PACKAGE_ID,
  DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID,
  DAML_FINANCE_LIFECYCLE_PACKAGE_ID,
  IRSFORGE_PACKAGE_ID,
} from './generated/package-ids'

/**
 * Fully-qualified template IDs for Daml Finance contracts the frontend
 * queries directly.
 *
 * Why this file exists: `LedgerClient.qualifyTemplateId` prefixes any
 * unqualified template name with `IRSFORGE_PACKAGE_ID`. That works for
 * contracts defined in IRSForge's DAR, but Daml Finance contracts live
 * in separate packages — naively passing `'Daml.Finance.X:Y'` would
 * resolve to `IRSFORGE_PKG:Daml.Finance.X:Y` (non-existent) and the
 * JSON API returns 400.
 *
 * Every consumer that queries a Daml Finance template must import the
 * pre-qualified constant from this file and pass it through as-is.
 * `qualifyTemplateId` sees two colons and leaves the ID alone.
 */

export const OBSERVATION_TEMPLATE_ID = `${DAML_FINANCE_DATA_PACKAGE_ID}:Daml.Finance.Data.V4.Numeric.Observation:Observation`

export const EFFECT_TEMPLATE_ID = `${DAML_FINANCE_LIFECYCLE_PACKAGE_ID}:Daml.Finance.Lifecycle.V4.Effect:Effect`

export const TRANSFERABLE_FUNGIBLE_TEMPLATE_ID = `${DAML_FINANCE_HOLDING_PACKAGE_ID}:Daml.Finance.Holding.V4.TransferableFungible:TransferableFungible`

export const LIFECYCLE_RULE_TEMPLATE_ID = `${DAML_FINANCE_CLAIMS_PACKAGE_ID}:Daml.Finance.Claims.V3.Lifecycle.Rule:Rule`

export const DATE_CLOCK_UPDATE_EVENT_TEMPLATE_ID = `${DAML_FINANCE_DATA_PACKAGE_ID}:Daml.Finance.Data.V4.Time.DateClockUpdate:DateClockUpdateEvent`

// IRSForge-native oracle templates (phase 1: curves on-chain). Both live in
// the IRSForge DAR, so they are pre-qualified with `IRSFORGE_PACKAGE_ID` —
// same shape as the Daml Finance constants above. Consumers must import
// these rather than passing unqualified names through `qualifyTemplateId`
// so the package ID is stable across DAR rebuilds.
export const CURVE_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Oracle.Curve:Curve`

// Append-only historical record of every curve publish. The operational
// Curve template holds the single latest per key (archive-on-publish);
// CurveSnapshot records every tick, keyed by `asOf`. Used by
// useCurveStream to hydrate sparkline history on mount so the Trend
// column isn't stuck at a single point.
export const CURVE_SNAPSHOT_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Oracle.CurveSnapshot:CurveSnapshot`

export const FLOATING_RATE_INDEX_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Oracle.FloatingRateIndex:FloatingRateIndex`

// Phase 3 Stage E — cross-currency reporting NPV translation reads
// this template for base/quote spot rates. Operator seeds one contract
// per `demo.fxSpots` entry at oracle startup.
export const FX_SPOT_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Oracle.FxSpot:FxSpot`

// Phase 2 (instrument-as-source-of-truth): per-family swap-instrument
// template IDs. The frontend queries these directly to read the
// authoritative on-chain economics for each swap family — `SwapWorkflow`
// no longer carries duplicate `swapTerms` after Stage C. All six live in
// the Daml Finance V0 swap-instrument package; pre-qualifying with
// `DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID` follows the same pattern as
// the Daml Finance constants above.
export const IRS_INSTRUMENT_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.InterestRate.Instrument:Instrument`
export const CDS_INSTRUMENT_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.CreditDefault.Instrument:Instrument`
export const CCY_INSTRUMENT_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.Currency.Instrument:Instrument`
export const FX_INSTRUMENT_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.ForeignExchange.Instrument:Instrument`
export const ASSET_INSTRUMENT_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.Asset.Instrument:Instrument`
export const FPML_INSTRUMENT_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.Fpml.Instrument:Instrument`

// Lookup table keyed by the `swapType` discriminator stored on
// `SwapWorkflow.swapType`. The frontend dispatches by this map to fetch
// the right per-family instrument. Note the `"FpML"` key matches the
// TS-side discriminator (camelCase) — distinct from the Daml-side
// `"FPML"` schedule-defaults map key. This split is intentional: TS
// uses the camelCase form throughout (see e.g. SwapType union in
// app/src/features/blotter/types.ts), Daml uses uppercase.
export const SWAP_INSTRUMENT_TEMPLATE_BY_TYPE: Record<string, string> = {
  IRS: IRS_INSTRUMENT_TEMPLATE_ID,
  // OIS rides the same Daml Finance InterestRate instrument family as IRS.
  OIS: IRS_INSTRUMENT_TEMPLATE_ID,
  CDS: CDS_INSTRUMENT_TEMPLATE_ID,
  CCY: CCY_INSTRUMENT_TEMPLATE_ID,
  FX: FX_INSTRUMENT_TEMPLATE_ID,
  ASSET: ASSET_INSTRUMENT_TEMPLATE_ID,
  // BASIS / XCCY / FpML all ride the Fpml.Instrument template — the
  // blotter decodes swapStreams via @irsforge/shared-pricing's
  // parsedFpmlToSwapConfig and classify routes the product.
  BASIS: FPML_INSTRUMENT_TEMPLATE_ID,
  XCCY: FPML_INSTRUMENT_TEMPLATE_ID,
  FpML: FPML_INSTRUMENT_TEMPLATE_ID,
}

// Phase 5 Stage A — IRSForge-native CSA / Mark / Shortfall templates.
// Live in the IRSForge DAR, so they are pre-qualified with
// `IRSFORGE_PACKAGE_ID` (same shape as `CURVE_TEMPLATE_ID` above).
export const CSA_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Csa.Csa:Csa`
export const MARK_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Csa.Mark:MarkToMarket`
export const SHORTFALL_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Csa.Shortfall:MarginShortfall`

// Tier 2 #8 — per-dispute audit-trail contract. Created when a CSA
// dispute opens (via `Dispute` choice), archived on resolution
// (via `AcknowledgeDispute` or `AgreeToCounterMark`). The active
// dispute's typed CID is stored as `Csa.activeDispute` on the
// originating Csa contract.
export const CSA_DISPUTE_RECORD_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Csa.Dispute:DisputeRecord`

// Phase 6 Stage A — scheduler role marker + NettedBatch audit row.
export const SCHEDULER_ROLE_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Setup.SchedulerRole:SchedulerRole`
export const NETTED_BATCH_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Csa.Netting:NettedBatch`

// Tier 2 #7 — per-family operator co-sign policy (auto vs manual). One
// contract per (operator, family). Bootstrap seeds 9 from YAML defaults;
// runtime changes are SetMode exercises, not YAML edits.
export const OPERATOR_POLICY_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Operator.Policy:OperatorPolicy`

// Task 4 — CsaProposal: operator + proposer co-sign to propose a CSA
// agreement. counterparty accepts/rejects; proposer can withdraw.
export const CSA_PROPOSAL_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Csa.Proposal:CsaProposal`

// Task 5 — IrsAcceptAck: acknowledgement record created by the
// `IrsProposeAccept` nonconsuming sister choice on `SwapProposal`.
// The choice itself is exercised on the IRS proposal template
// (PROPOSAL_TEMPLATES.IRS); this constant is for querying the ack record.
export const IRS_ACCEPT_ACK_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.Proposal:IrsAcceptAck`

// Task 7 — AcceptAck templates for the other 8 swap families.
// Each lives in its proposal file (same module pattern as IRS above).
export const OIS_ACCEPT_ACK_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.OisProposal:OisAcceptAck`
export const BASIS_ACCEPT_ACK_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.BasisSwapProposal:BasisAcceptAck`
export const XCCY_ACCEPT_ACK_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.XccyFixedFloatProposal:XccyAcceptAck`
export const CDS_ACCEPT_ACK_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.CdsProposal:CdsAcceptAck`
export const CCY_ACCEPT_ACK_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.CcySwapProposal:CcyAcceptAck`
export const FX_ACCEPT_ACK_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.FxSwapProposal:FxAcceptAck`
export const ASSET_ACCEPT_ACK_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.AssetSwapProposal:AssetAcceptAck`
export const FPML_ACCEPT_ACK_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.FpmlProposal:FpmlAcceptAck`

// Proposal templates — the pre-Accept state for each swap family. These are
// what a trader creates when they click PROPOSE in the workspace. Mirrors
// PROPOSAL_TEMPLATES in features/workspace/hooks/build-proposal-payload.ts,
// but with the full package-id prefix so the onchain-activity stream can
// subscribe to them.
export const IRS_PROPOSAL_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.Proposal:SwapProposal`
export const OIS_PROPOSAL_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.OisProposal:OisProposal`
export const BASIS_PROPOSAL_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.BasisSwapProposal:BasisSwapProposal`
export const XCCY_PROPOSAL_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.XccyFixedFloatProposal:XccyFixedFloatProposal`
export const CDS_PROPOSAL_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.CdsProposal:CdsProposal`
export const CCY_PROPOSAL_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.CcySwapProposal:CcySwapProposal`
export const FX_PROPOSAL_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.FxSwapProposal:FxSwapProposal`
export const ASSET_PROPOSAL_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.AssetSwapProposal:AssetSwapProposal`
export const FPML_PROPOSAL_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.FpmlProposal:FpmlProposal`

// ProposalDelegation — operator-signed delegation that lets traders create
// proposals with only their own party authority (production OIDC profile).
// One contract per (operator, traders[]) tuple, created at bootstrap.
export const PROPOSAL_DELEGATION_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.ProposalDelegation:ProposalDelegation`

// SwapWorkflow — active swap (post-Accept). MaturedSwap — terminal row.
export const SWAP_WORKFLOW_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.Workflow:SwapWorkflow`
export const MATURED_SWAP_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Swap.Workflow:MaturedSwap`

// Bootstrap templates — queried by the operator bootstrap-status card to
// confirm the platform is fully initialized. Mirror the `submit operator`
// creates in contracts/src/Setup/InitImpl.daml.
export const ROLE_SETUP_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Setup.RoleSetup:RoleSetup`
export const EVENT_FACTORY_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Setup.EventFactory:EventFactory`
export const CASH_SETUP_RECORD_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Setup.CashSetup:CashSetupRecord`
export const DEMO_STUB_PROVIDER_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Oracle.DemoStubProvider:DemoStubOracleProvider`
export const NYFED_PROVIDER_TEMPLATE_ID = `${IRSFORGE_PACKAGE_ID}:Oracle.NYFedProvider:NYFedOracleProvider`

// Bootstrap factories — one Daml Finance per-product Factory template per
// swap family. Each is created once at platform bootstrap (see
// contracts/src/Setup/InitImpl.daml lines 124–139) and lives in the
// Daml Finance Instrument Swap V0 package.
export const IRS_FACTORY_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.InterestRate.Factory:Factory`
export const CDS_FACTORY_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.CreditDefault.Factory:Factory`
export const CCY_FACTORY_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.Currency.Factory:Factory`
export const FX_FACTORY_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.ForeignExchange.Factory:Factory`
export const ASSET_FACTORY_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.Asset.Factory:Factory`
export const FPML_FACTORY_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.Fpml.Factory:Factory`

// HolidayCalendar — one per configured currency.
export const HOLIDAY_CALENDAR_TEMPLATE_ID = `${DAML_FINANCE_DATA_PACKAGE_ID}:Daml.Finance.Data.V4.Reference.HolidayCalendar:HolidayCalendar`
