---
title: Operator Role
---

# Operator Role

The `Operator` is a first-class party on every IRSForge deployment, distinct from the trader counterparties. It models the **platform operator** — the entity running the IRSForge service that two trading firms have both onboarded with.

In TradFi terms, this is the role a clearing venue, a tri-party agent, or a DLT platform operator plays: a third party that doesn't take economic risk on the trade but mediates issuance, lifecycle, and reference data on behalf of the bilateral counterparties.

If you're looking for the operator UI reference (queue, disputes, health), see [`ui/operator`](../ui/operator). This page covers *why the operator exists* and *what authority it carries on-chain*.

## Why a third party at all

Two firms can do bilateral Daml between themselves with no operator involved. IRSForge needs an operator because:

1. **Daml Finance factories require operator authority.** The `Factory.Create` choice that mints an `Instrument` is signed by a `provider` party — not by the two trade counterparties. Without a stable third-party signer, every trade would need its own ad-hoc factory deployment.
2. **Reference data is platform-wide.** Currencies, rate indices (SOFR, ESTR, …), holiday calendars, oracle observations, and curve snapshots are shared across every counterparty pair. A single operator-owned authority publishes them and every trader observes.
3. **Compliance gating wants a non-trader actor.** Optional manual co-sign on trade acceptance ([Stage 2](./swap-lifecycle#stage-2--accept)) requires an authority that's structurally separate from both economic counterparties.
4. **Regulator hand-off has a defined source.** The operator includes configured regulator parties as observers on every contract it provisions, so audit visibility flows from one place.

The `org.role: operator` field is required and **schema-enforced as exactly one per deployment** (`shared-config/src/schema-orgs.ts`). Regulator orgs are also role-declared; the schema requires at least one and supports more than one.

## On-chain footprint

The operator appears on-chain as either a **signatory** (its authority is required for the contract to exist) or an **observer** (it can read the contract). The shape:

| Contract | Operator role | Why |
|---|---|---|
| `Setup.RoleSetup` | signatory | Bootstrap marker — proves the deployment was provisioned |
| `IRS / CDS / CCY / FX / Asset / FpML Factory` | signatory (provider) | Required by Daml Finance for `Factory.Create` |
| `LifecycleRule`, `EventFactory` | signatory | Authority chain for `Lifecycle.Evolve` |
| `HolidayCalendar`, `Currency`, `FloatingRateIndex` | signatory | Shared reference data |
| `Observation`, `Curve`, `CurveSnapshot` | signatory (or co-signed with `scheduler`) | Oracle authority — see [Canton Oracle Model](../oracle/overview) |
| `<Family>Proposal` (IRS, OIS, Basis, Xccy, CDS, Ccy, Fx, Asset, FpML) | **signatory** with `proposer` | Pre-co-signs so `Accept` body inherits factory auth |
| `<Family>AcceptAck` | signatory with `proposer` + `counterparty` | Manual-policy co-sign holding pen |
| `Operator.Policy:OperatorPolicy` | **signatory** | Per-family auto/manual mode; one contract per `(operator, family)` pair |
| `Csa` | signatory with `partyA` + `partyB` | Operator co-owns the bilateral CSA (Bloomberg MARS convention) |
| `CsaProposal` | signatory with `proposer` | Same proposal pattern as swaps |
| `MarginCallOutstanding`, `Csa.Dispute:DisputeRecord` | observer | Operator monitors disputes and adjudicates `Escalated` cases (only on-chain path out of `Escalated`) |
| **`SwapWorkflow`** (the live trade) | **observer** | Once minted, the bilateral trade has `signatory partyA, partyB` only |
| **Cash holdings** | not present | Operator never holds positions |

The headline: operator authority is **everywhere at provision-time**, but the operator is **not on the bilateral instrument body** once the trade is live. It mints the trade and gates its lifecycle, but doesn't own the trade.

## What the operator does

### 1. Co-sign trade proposals

Every `<Family>Proposal` template declares `signatory proposer, operator`. Creating a proposal therefore requires `submitMulti [proposer, operator] []` — the operator's authority is consumed inline so that the eventual `<Family>Accept` choice has enough authority to invoke `Factory.Create`.

```daml
template CcySwapProposal
  with operator : Party; proposer : Party; counterparty : Party; ...
  where
    signatory proposer, operator
    observer  counterparty
```

### 2. Optionally gate acceptance (auto vs manual)

`Operator.Policy:OperatorPolicy` is an on-ledger contract per `(operator, family)` pair carrying `mode: Auto | Manual`. Bootstrap seeds 9 from `operator.policy.<FAMILY>` defaults in `irsforge.yaml`; runtime changes happen via the `SetMode` choice from the operator UI's Auto-policy card. The acceptance flow branches on the contract's `mode`:

- **`Auto`** — counterparty exercises `<Family>Accept` directly. The operator's standing co-signature on the proposal carries through; the live `SwapWorkflow` lands in one transaction. Operator queue stays empty.
- **`Manual`** — counterparty exercises `<Family>ProposeAccept` → creates `<Family>AcceptAck` → operator reviews on `/org/<id>/operator` → exercises `<Family>ConfirmAccept` → `SwapWorkflow` lands. Either side can cancel before the operator acts.

This is a **compliance choice**, not a technical one. Same on-chain end state; the manual path inserts a human review gate. See [Operator UI — Auto-policy](../ui/operator#auto-policy) for the per-family card and toggle behavior.

### 3. Resolve CSA disputes

The operator is signatory on every `Csa` contract alongside the two traders. Resolution is **not** operator-only: the counterparty can clear a `MarkDisputed` CSA bilaterally via `AgreeToCounterMark` (re-publishes mark at the disputer's claimed value, no operator authority required) or escalate it via `EscalateDispute`. The operator's `AcknowledgeDispute` is the final arbiter — and the **only** path out of `Escalated`, which is the state a dispute lands in once bilateral negotiation has failed.

The bilateral path is on-chain by design: a Canton-grade reference impl whose dispute model can only resolve through a trusted operator silently contradicts Canton's two-party-workflow positioning. `Escalated` deliberately closes the bilateral exit so the new state has on-chain meaning beyond a UI flag, mirroring what real ISDA §5 dispute resolution does after Resolution Time elapses. See [CSA Model — Dispute taxonomy and resolution paths](./csa-model#dispute-taxonomy-and-resolution-paths).

### 4. Maintain platform reference data

Currencies, rate indices, holiday calendars, oracle observations, curve snapshots — all `submit operator` (or co-signed with the `scheduler` service account, see [Scheduler Authority](../oracle/scheduler)). Traders observe; only the operator can publish.

### 5. Run scheduler-fallback lifecycle

When the autonomous scheduler is stalled, the operator can manually drive `TriggerLifecycle` on `CCY` / `FX` / `FpML` swaps via the operator UI. The dual `LifecycleRule` accepts either signer — operator authority works as a break-glass without redeploying anything.

## What the operator structurally cannot do

| Cannot | Reason |
|---|---|
| Be `partyA` or `partyB` on a swap | `SwapWorkflow` declares `signatory partyA, partyB` — operator isn't in that set |
| Propose a trade | Proposal controllers are trader parties; operator UI hides the "New Swap" button (`ui/operator.md:108`) |
| Accept / Reject / Withdraw a trade | Choice controllers are trader parties |
| Unwind a live swap | `terminateProposal` controller is trader-side |
| Hold cash or instruments | Operator never appears as `owner` on Daml Finance holdings |
| Unilaterally cancel a live `SwapWorkflow` | Workflow body has only the two traders as signatories |

The full bidirectional gating audit is in [`ui/operator` — what the operator can't do](../ui/operator#what-the-operator-account-cant-do).

## Demo vs production

Same on-chain shape, different participant topology and trust model.

| | Demo | Production |
|---|---|---|
| **Hosted on** | The single Canton sandbox alongside every other party | The platform-operator's own Canton participant node, under separate org |
| **Auth** | `auth.provider: demo` — party-selector mints a JWT for `Operator` on click | `auth.provider: oidc` — the IdP proves operator identity; IRSForge auth service mints the operator-scoped Canton ledger JWT |
| **Operator service credential** | Browser-minted, ephemeral | `mark-publisher` service-account secret in a secrets manager; auth service exchanges it for short-lived ledger JWTs |
| **`OperatorPolicy.<FAMILY>` mode** | All 9 families on `Auto` (zero-friction demo) | Mixed `Auto` / `Manual` per compliance regime; flipped via `SetMode` on the on-ledger contract; manual queue is staffed and paged |
| **Compliance reviewer** | Whoever is clicking the demo | A human at the platform operator (with PagerDuty / Slack hook on new queue items — roadmap) |
| **Trust model** | Operator is just another persona on a single ledger | Operator is the platform's commitment to the two firms — they trust the platform-operator the way they'd trust a CCP or tri-party agent |

In demo the operator looks invisible because everything is on one sandbox and `auto` policy short-circuits the queue. In production the operator is **what makes a bilateral trade a *platform* trade** rather than two firms doing arbitrary Daml on their own ledgers — same code, different operating model.

For the production cutover checklist (OIDC wiring, secrets, manual buttons off) see [Deploying to Production](../operations/deploying-production).

## Mental model

```
        ┌────────────────────┐
        │     Operator       │   ← platform authority
        │  (provision +      │     (factory provider, lifecycle,
        │   gate + publish)  │      reference data, dispute resolver)
        └─────────┬──────────┘
                  │ co-signs
        ┌─────────┴──────────┐
        ▼                    ▼
  ┌──────────┐         ┌──────────┐
  │  PartyA  │ ◀────▶ │  PartyB  │   ← the live bilateral trade
  └──────────┘         └──────────┘     (signatory partyA, partyB)
        ▲                    ▲
        └────────┬───────────┘
                 │ observes
        ┌────────▼─────────┐
        │    Regulator     │   ← read-only audit
        └──────────────────┘
```

PartyA ↔ PartyB own the **economic relationship**. The operator sits **above** them as the **platform / factory / oracle authority**. The regulator sits **below** with read-only audit visibility. None of these can swap roles — cardinality and signatory shape enforce it on-chain.
