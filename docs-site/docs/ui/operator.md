---
title: Operator view
sidebar_label: Operator
---

# Operator view (`/org/[orgId]/operator`)

**Purpose:** monitor compliance co-signs, dispute adjudication, upcoming lifecycle events, and platform health.
**Who uses it:** the `Operator` party only — trader parties (PartyA, PartyB, etc.) do not see this nav item.
**MARS analog:** back-office admin console — dispute adjudication, scheduler monitoring, manual recovery.

For the conceptual *why* — what the operator party is, why a third-party signer exists at all, and how the role differs in demo vs production — see [Operator Role](../concepts/operator-role). This page is the UI reference for the console itself.

When you log in as an `org.role: operator` party, IRSForge replaces the standard nav with an operator-specific console. Four cards:

---

## 1. Bootstrap status

A pre-flight panel showing how many swap-instrument templates are wired against the on-chain factories. Used during initial deployment / DAR upgrades to verify the platform is fully bootstrapped before traders start proposing.

---

## 2. Operator queue

Pending items requiring operator authority, sorted by urgency.

### Disputes (highest priority)

CSAs where mark-to-market is in `MarkDisputed` or `Escalated` state. The card shows:

- counterparty pair (`PartyA – PartyB`)
- disputed mark amount and currency
- dispute reason (`Valuation` / `Collateral` / `FxRate` / `Threshold` / `IndependentAmount` / `Other`)
- time since dispute was raised
- severity tag — `Escalated` rows surface above plain `MarkDisputed` rows since the bilateral exit is already closed

Click any row to open the CSA drawer. The button label flips dynamically: **Resolve dispute** for `MarkDisputed`, **Resolve escalated dispute** for `Escalated`. Both fire `AcknowledgeDispute`, which re-publishes a fresh mark, archives the `Csa.Dispute:DisputeRecord`, and returns the CSA to `Active`.

`MarkDisputed` is the only state where the operator queue is *one* of the resolution paths — the counterparty can also clear it bilaterally via `AgreeToCounterMark` without operator involvement. `Escalated` is operator-only. See [CSA Model — Dispute taxonomy and resolution paths](../concepts/csa-model#dispute-taxonomy-and-resolution-paths) for the full state machine.

### Pending co-signs

`<Family>AcceptAck` contracts awaiting `<Family>ConfirmAccept` when the on-ledger `OperatorPolicy` for that family is in `Manual` mode (see [Auto-policy](#auto-policy) below). Each row shows:

- swap family (IRS / OIS / BASIS / XCCY / CDS / CCY / FX / ASSET / FpML)
- proposer and counterparty
- proposed notional and tenor

The **Co-sign** button fires `<Family>ConfirmAccept` directly, creating the `SwapWorkflow`.

### Empty state — explains the routing posture

A blank queue isn't ambiguous. The empty state reads on-ledger `Operator.Policy:OperatorPolicy` contracts (one per family, seeded at bootstrap, mutable via the [Auto-policy card](#auto-policy)) and renders one of:

- `All 9 families on auto-policy · proposals don't need co-sign` (current demo default)
- `7 auto · 2 manual · queue activates when a manual-policy proposal is routed for review` (mixed)

…plus `0 CSA disputes` underneath. Tells the operator the queue is empty *because the system is configured this way*, not because something's broken — the real concern when staring at a 0-count page in production.

---

## 3. Upcoming lifecycle events

A 90-day lookahead of every live `SwapWorkflow` whose instrument matures in-window. Each row shows:

```
2026-07-16  IRS  Maturity  Goldman Sachs – JPMorgan  10.0M   in 82 days   ledger
```

Clicking the row navigates to `/org/<id>/workspace?swap=<cid>` — the canonical swap-detail destination, matching how blotter active-row clicks already route. The right-side `ledger` link drops into `/org/<id>/ledger?cid=<cid>` for the audit drill-down.

Coupon and fixing dates are derivable from the periodic schedule but not yet surfaced — the lookahead is maturity-only today. Production operators typically scope to 7–14 days; widen only when there's content to see.

---

## 4. Health

### Scheduler liveness

A `SchedulerStatusPill` (green / amber / red) derived from the age of the most recent scheduler heartbeat. Red if no heartbeat in `SCHEDULER_STALL_MS` (5 min). Clicking the pill shows the last-seen timestamp and the scheduler party hint.

### Per-curve staleness

A table of every `Oracle.Curve:Curve` visible to the operator, with columns:

| Status | CCY | Type | Age | … |
|---|---|---|---|---|
| OK / Stale dot + label | USD | Discount | `<1m` | (Why? button on stale rows) |

Stale rows render with a red background and expose a **Why?** drill-down: last-published timestamp, age, indexId, source description, and recommended action ("If the scheduler is stalled, use *Publish fixing manually* below for the affected swap").

### Manual fallbacks — stuck-swaps picker

When the scheduler is stalled, the **Manual fallbacks** section replaces the legacy "paste a CID" form with a list of every live `SwapWorkflow` and per-row action:

| Type | Pair | Notional | Action |
|---|---|---|---|
| `CCY` / `FX` / `FpML` | partyA–partyB | 5M | **Trigger** → opens dialog with the cid prefilled (read-only, Change link unlocks free entry) |
| `IRS` / `OIS` / `BASIS` / `XCCY` / `CDS` / `ASSET` | partyA–partyB | 10M | **Workspace →** deep-link (operator override doesn't resolve rate observations; use the workspace flow which has rate inputs in hand) |

Healthy state preserves a single disabled button with the rationale: *"Available only when scheduler is stalled."*

The dialog collects a swap contract id and event date; on submit it delegates to `resolveTriggerLifecycleInputs` (same path the scheduler uses) and calls `exerciseWorkflowChoice` with the operator's JWT. Authority comes from the dual `LifecycleRule` shipped in scheduler-authority Phase C1/C2 — the choice accepts either signer.

---

## What the operator account *can't* do

Operator is structurally **not** a `partyA` or `partyB` on swaps or CSAs. Any UI button whose on-chain controller is the trading party is hidden when `useIsOperator()` is true (audit pass `b01304e`):

| Surface | Action | Why hidden |
|---|---|---|
| Blotter | "New Swap" button | Operator can't be a proposer |
| Workspace draft mode | PROPOSE block + Import FpML | Same — proposal signatory is `proposer, operator`, not `operator, _` |
| Workspace `Proposed` swap | Accept / Reject / Withdraw | Controller = trading party |
| Workspace `Active` swap | Unwind | `terminateProposal/propose` controller = trading party |
| Workspace `PendingUnwind` swap | Accept / Reject / Withdraw Unwind | Same |
| `/org/<id>/csa` | New CSA proposal | Moved to trader `/csa` page since `8b8b5c7` |
| CsaProposalsTable | Accept / Reject / Withdraw | `directionForMe` returns `'observer'` for operator → no actions |

Operator can still navigate Blotter, Workspace, CSA pages **read-only** to inspect on-chain state. The CSA drawer routes operator to `CsaOperatorActions` (`AcknowledgeDispute`) instead of trader-side `CsaFundingActions` (Mark / Settle / Dispute).

---

## Auto-policy

Per-family auto/manual co-sign mode lives on-ledger as `Operator.Policy:OperatorPolicy` — one contract per `(operator, family)` pair, signatory `operator`, observers `regulators ∪ traders`. The `Auto-policy` card on `/operator` lists all 9 families with a toggle:

```
IRS    [auto]
OIS    [auto]
BASIS  [auto]
XCCY   [auto]
CDS    [manual]   ← clickable, flips to auto
…
```

Toggles are operator-only — non-operator viewers see the same posture (read access via the `traders` observer set) but every button is disabled.

Bootstrap seeds 9 contracts at platform init from `operator.policy.<FAMILY>` defaults in `irsforge.yaml`:

```yaml
operator:
  policy:
    IRS: auto     # bootstrap seed only — runtime changes live on-ledger
    CDS: manual
    FpML: manual
    FX: auto
    CCY: auto
```

After bootstrap the YAML is **inert**. Runtime changes happen through the `OperatorPolicy.SetMode` choice (recreates the contract with the new mode; cid rotates). Editing the YAML re-bootstraps a fresh sandbox; existing contracts are untouched.

### `auto` mode (default for all 9 families in demo)

The counterparty exercises `<Family>Accept`. The choice runs with `actAs: [counterparty, operator]` using the operator's standing delegation. `SwapWorkflow` is created immediately. The operator queue stays empty.

### `manual` mode

1. Counterparty exercises `<Family>ProposeAccept` (non-consuming).
2. A `<Family>AcceptAck` contract is created (signatories: proposer, counterparty, operator).
3. Operator sees the pending item in the **Operator queue** and exercises `<Family>ConfirmAccept`.
4. `<Family>ConfirmAccept` exercises the original `<Family>Accept` and creates `SwapWorkflow`.

Either side can cancel before the operator acts:

- `<Family>AcceptAckCancelByCounterparty` — counterparty retracts
- `<Family>AcceptAckCancelByOperator` — operator rejects at the ack stage

### Why on-ledger?

Storing policy in YAML reads the same as on-chain in demo, but breaks down in production:

- **Audit trail** — flipping CDS from auto to manual is a regulator-visible ledger event, not a file change buried in a config repo PR.
- **Single source of truth** — config drift between participants becomes impossible; everyone sees the same `OperatorPolicy` contract.
- **No file mutation from the browser** — the toggle is a Daml choice, not a write-to-disk hack.

---

## Role-aware nav

The **Operator** sidebar item is rendered only when the active org has `org.role: operator`. Operator org membership is declared structurally in `irsforge.yaml` and cardinality is enforced at config load. See [config YAML reference](../reference/config-yaml) for the full role enum.

The shell also route-gates this page. A trader or regulator who navigates directly to `/org/<id>/operator` is redirected to that role's landing page before the console renders; on-chain authority checks still remain the final control for mutations.

---

## Demo vs production

| | Demo | Production |
|---|---|---|
| Scheduler | TS `oracle/` process running locally (signs with the Scheduler JWT) | Real participant operating the Scheduler role |
| Auto-policy defaults | All 9 families on `auto` (zero-friction demo flow) | Mixed `auto`/`manual` per compliance regime; operator queue staffed and paged on new items |
| Empty queue | Expected — click a family in the Auto-policy card to flip it manual and populate the queue for demo | Expected most of the time; non-empty should page operator (PagerDuty / Slack — out of scope today) |
| Manual fallbacks | Click "Publish fixing manually" to unstick a demo workflow when oracle is paused | Break-glass during a real scheduler outage — used while incident is being resolved |
| Bootstrap status | Shows full template wiring on first DAR install | Re-checked after every contract upgrade |

---

## Roadmap

- **CSA template library** — operator publishes standard NY / English-law term sheets; traders pick one rather than entering raw parameters. Logged as `§Out` in the operator-view spec.
- **Republish-curve wiring** — replace the stub `window.alert` on stale curve rows with a real call into the oracle signer arm.
- **Full-path manual lifecycle** — observation resolution for IRS / CDS / BASIS / XCCY / OIS / ASSET so "Publish fixing manually" covers all 9 swap families (`manual-lifecycle.ts:27` TODO).
- **Hard auth gate on `/operator`** — reject non-operator parties at the route level rather than relying on on-chain authority rejection.
- **Lifecycle events: coupons + settlements** — extend the 90-day lookahead beyond maturities to surface upcoming fixings and cashflows.
- **Alert routing** — webhook to PagerDuty / Slack on new queue items so operators don't poll the page.
- **Item age / SLA timer** on queue rows — stale unattended approvals are an audit finding.
