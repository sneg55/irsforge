---
title: Compliance & Audit
sidebar_position: 3
---

# Compliance & Audit

Single page for the Compliance / Legal seat on the buying committee. What the system commits to in writing, what it produces as a paper trail, and where the explicit gaps are.

## ISDA conventions adopted

IRSForge consumes ISDA-shaped date math from Daml Finance's `V3.Types.Date` modules. Conventions are not reimplemented; they are imported as shipped.

| Convention | Where applied | Source |
|---|---|---|
| Day count: Act/360, Act/365F, 30/360, 30E/360 | Every per-family proposal | `DayCountConventionEnum` |
| Roll convention: derived from `startDate` day-of-month, with `lastRegularPeriodEndDate` back-stub on DOM mismatch | Schedule generation | `RollConventionEnum`, ISDA back-stub pattern |
| Schedule frequency | Per-leg, per-product | `ScheduleFrequency` |
| Business-day adjustment | Available but informational only on a 24/7 ledger (see below) | `BusinessDayConventionEnum` |
| Holiday calendar | Setup-time only, informational | `HolidayCalendarData` |
| Floating index compounding: `CompoundedInArrears`, `OvernightAverage`, `Simple` | Per-index in `floatingRateIndices:` | `FloatingRate.ReferenceRateTypeEnum` |
| Compounded index lookback | Per-index | YAML `lookback:` |

Full mapping in [Daml Finance Interfaces](./architecture/daml-finance-interfaces).

## FpML round-trip

Every existing IR-derivatives platform (Bloomberg, IHS Markit, ICE) speaks FpML. IRSForge supports FpML 5.x **import and export** for the families that have an FpML schema (IRS, OIS, basis, XCCY).

- Import: paste FpML XML into the workspace; the leg composer populates from the parsed schedule.
- Export: any live `SwapWorkflow` can be downloaded as FpML.
- Round-trip: import → propose → archive on a sandbox is part of the test surface.

A Canton-resident swap can be moved into and out of off-chain systems without manual re-keying. Confirmation matching against an off-chain platform is therefore unblocked at the schema level.

See [FpML import / export](./ui/fpml-import-export).

## Confirmation in lieu of PDF

The on-chain `Accept` choice replaces a PDF confirm. The legal posture:

- The proposal payload contains the full economic terms.
- The counterparty's `Accept` is a Daml choice signed by their party. The participant node validates the signature.
- The resulting `SwapWorkflow` has both `partyA` and `partyB` as signatories. Cryptographic non-repudiation is intrinsic.
- Both sides observe the same contract on their respective participants; there is no "your copy of the trade vs my copy" to reconcile.

The `Accept` choice is the confirmation. Auditable, cryptographically signed, immutable on the ledger. No paper trail needed; the ledger is the paper trail.

## Regulator visibility, by construction

Every swap-related contract lists the configured `regulators: [Party]` as observers at creation. This is not a periodic export; the regulator participant gets the contract over the standard Canton private-data channel as soon as it lands.

What the regulator sees:

- Every proposal, accept, reject, withdraw across all five product families.
- Every `SwapWorkflow` with full payload (schedule, legs, references).
- Every `Csa`, `MarginCallOutstanding`, `Csa.Dispute:DisputeRecord`, `MarkSnapshot`, `SettlementAudit`.
- Every `Observation`, `Curve`, `CurveSnapshot` published by any oracle provider.
- Every matured or terminated swap (with `terminatedByParty` and reason).

What the regulator cannot do:

- Author trades.
- Hold positions.
- Adjudicate disputes.
- See contracts they were not added as observer to (Canton sub-transaction privacy).

Multi-jurisdiction is supported. The schema permits ≥ 1 regulator org since 2026-04, and `regulators: [Party]` threads through every relevant template (CSA / SettlementAudit / MaturedSwap / TerminatedSwap / SwapWorkflow / proposals / oracle).

## Dispute paper trail

A dispute is a contract, not an email. Every state transition is on-ledger and observed by the regulator.

```
Csa (Active or MarginCallOutstanding)
   │
   │ exercise Dispute by partyA or partyB
   │   reason ∈ {Valuation, Collateral, FxRate, Threshold, IndependentAmount, Other}
   │   counterMark, notes
   ▼
Csa (MarkDisputed)              Csa.Dispute:DisputeRecord (audit record, signatory operator)
   │                              · disputer, counterMark, reason, notes, openedAt
   │
   ├── exercise AgreeToCounterMark by counterparty (the non-disputer)
   │       └─▶ new MarkToMarket at counterMark; DisputeRecord archives
   │           ▼
   │     Csa (Active)
   │
   ├── exercise EscalateDispute by counterparty (the non-disputer)
   │       │
   │       ▼
   │     Csa (Escalated)         (bilateral exit closed; operator-only resolve)
   │       │
   │       │ exercise AcknowledgeDispute by operator
   │       ▼
   │     Csa (Active)            new MarkToMarket; DisputeRecord archives
   │
   └── exercise AcknowledgeDispute by operator
           └─▶ Csa (Active); DisputeRecord archives
```

The regulator observes every transition: the `DisputeRecord` create event surfaces as `DisputeOpened` (with reason, counterMark, notes), `Csa` transitioning to `Escalated` surfaces as `DisputeEscalated`, and the `DisputeRecord` archive event surfaces as `DisputeResolved` (with resolution kind `'agreed'` for `AgreeToCounterMark` or `'operator-ack'` for `AcknowledgeDispute`).

Counterparties **can** bypass the operator on the bilateral path (`AgreeToCounterMark`) — that's the architectural intent: Canton enables two-party workflows that don't need an arbiter when both sides agree. The operator stays as the only path out of `Escalated`, which is exactly when bilateral agreement has failed and a neutral adjudicator is required. Neither party can retroactively un-dispute or modify a `DisputeRecord` once opened. Reload-resilient timeline view at `/oversight/timeline` for the regulator UI ([Regulator role v2](./concepts/operator-role)).

## On-ledger, not on email

All of the following are Daml contracts, not external workflow:

- Trade proposal and acceptance.
- Margin call and post.
- Mark publish.
- Dispute and acknowledge.
- Settlement (per leg).
- Mature, terminate / unwind.
- Curve publish.
- Service-account token mint (off-ledger but logged in `auth/`).

The audit trail is the contract set. CSV export is available from any blotter / regulator surface, but the surface of record is the ledger.

## Continuous 24/7 settlement vs ISDA conventions

The Canton ledger runs 24/7 with no batch close. This deliberately changes a few ISDA conventions:

| Off-chain convention | On-chain reality |
|---|---|
| EOD batch settlement | Continuous, scheduler-driven |
| Holiday calendars | Informational only; ledger does not pause |
| Modified Following / Preceding business-day adjustment | Available in proposal payload; ignored by lifecycle |
| T+1 / T+2 cashflow lag | Not applicable; settlement on the cashflow date |
| Confirmation deadline | The `Accept` choice is the confirmation; no separate deadline |

This is a feature, not a gap. Continuous settlement removes weekend/holiday open positions. If your compliance regime requires Modified Following adjustment for accrual, it is preserved in the payload and reportable; the ledger simply does not gate cashflows on it. See [Swap Lifecycle](./concepts/swap-lifecycle).

## Data-vendor licensing posture

You bring your own data license. IRSForge ships:

- **NY Fed SOFR** as a real reference provider (public source).
- **Demo stub** for offline runs.

Both go through the same `Oracle.Interface.Provider` seam. To plug in Markit, Bloomberg, ICE, or Refinitiv, you implement the seam and ship your own adapter. **IRSForge does not redistribute licensed market data.** The licensing relationship is between your firm and the data vendor; the IRSForge seam is purely the transport.

See [BYO Oracle](./integrators/byo-oracle) for the three-step extension.

## What's in scope

- Five swap families: IRS, OIS, basis, XCCY, CDS.
- Margin model: signed CSB per pair, threshold, MTA, rounding, multi-currency valuation.
- Confirmations: on-chain via `Accept`.
- Dispute lifecycle: with operator adjudication.
- Audit observers: regulator(s) on every relevant contract.
- FpML round-trip for the FpML-expressible families.
- Continuous lifecycle: scheduler-driven trigger / settle / mature.
- Termination: `TerminateProposal` with PV transfer at agreed mid.

## What's out of scope (today)

Explicit, by design.

- **Credit-event lifecycle for CDS**: ISDA Determinations Committee outcomes triggering contingent payment. Templates exist; the live trigger flow is integrator scope.
- **ISDA Standard Model parity for CDS pricing**: flat-forward hazard, JPMCDS routines. IRSForge ships a hazard-rate seam; the JPMCDS implementation is integrator scope.
- **KYC / AML / booking-system integration**: IRSForge does not perform KYC, AML, or sanctions checks. These belong upstream of the proposal.
- **Trade reporting (DTCC GTR, EMIR, MiFID, SFTR)**: regulator-as-observer gives you the data; the wire format and reporting cadence is integrator scope.
- **XVA**: out of scope.
- **Holiday calendars / business-day adjustments enforced**: see above.
- **Versioning** of the docs site itself.

## See also

- [Risk & Controls](./risk-and-controls) — controls model and audit surfaces
- [Security & Trust](./security-and-trust) — credential and trust boundaries
- [Operator Role](./concepts/operator-role) — why a third party signs every proposal
- [CSA Model](./concepts/csa-model) — signed-CSB convention
- [Daml Finance Interfaces](./architecture/daml-finance-interfaces) — every imported convention, with file references
- [FpML import / export](./ui/fpml-import-export) — round-trip evidence
