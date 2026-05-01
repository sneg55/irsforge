---
title: Risk & Controls
sidebar_position: 2
---

# Risk & Controls

Single page for the Head of Risk seat on the buying committee. What the on-chain shape gives you, what it does not, and where the controls live in the codebase.

## Three-party authority model

IRSForge separates economic counterparties from platform authority and from automation, on-chain.

| Authority | Party | Holds risk? | Can author trades? | Can adjudicate disputes? | Can drive lifecycle automation? |
|---|---|---|---|---|---|
| Trading firm | `partyA` / `partyB` | Yes | Yes | No | No |
| Platform operator | `Operator` | No | No | Yes | Manual fallback only |
| Automation | `Scheduler` | No | No | No | Yes |
| Regulator | `Regulator` | No | No (observer) | No (observer) | No (observer) |

The shape is enforced at the Daml signatory layer, not in middleware. An operator literally cannot become a counterparty on a `SwapWorkflow` because the template lists `signatory partyA, partyB` only. Likewise the scheduler cannot adjudicate a dispute because `AcknowledgeDispute` lists `controller operator`. See [Operator Role](./concepts/operator-role) for the full structural-prohibition table.

## Regulator visibility

Every swap-related contract lists the configured regulator parties as observers at creation. The regulator sees:

- `SwapWorkflow` (every live trade) and its proposal.
- `Csa` and every state transition (`Active`, `MarginCallOutstanding`, `MarkDisputed`, `Escalated`, `Terminated`).
- `MarkSnapshot` and `SettlementAudit` projections.
- `MaturedSwap` and `TerminatedSwap` audit records.
- `Observation`, `Curve`, `CurveSnapshot` published by the oracle.

Read access is a Canton primitive (sub-transaction privacy enforced by the participant nodes), not a separate audit pipeline. Counterparties cannot see each other's positions; the regulator sees both.

Multi-jurisdiction is supported: the schema allows ≥ 1 regulator org, and the `regulators: [Party]` field threads through every relevant template. The field-level migration that enabled multiple regulators landed in v2 of the regulator role; see [Topology](./concepts/topology) for the schema constraints.

## Audit trail surfaces

Every state-changing event lands as a Daml contract. None are deleted; the ledger is append-only.

| Surface | Cardinality | What it records |
|---|---|---|
| `SwapWorkflow` | one per live trade | Full payload, both legs, references |
| `SwapProposal` and family variants | one per pending proposal | Originating intent, signatories |
| `MarkSnapshot` | append-only | Per-CSA mark history (powers sparkline + EOD reports) |
| `SettlementAudit` | append-only | Cash-leg projection of every settlement, viewable by regulator |
| `MaturedSwap` | one per matured swap | Originating payload + actual maturity date |
| `TerminatedSwap` | one per unwound swap | `terminatedByParty`, reason, terminal date, agreed PV |
| `MarginCallOutstanding` | one per open call | Required pledge, direction, deadline |
| `Csa.Dispute:DisputeRecord` | one per active dispute, archived on resolution | Disputer, claimed counter-mark, six-value `DisputeReason` (`Valuation` / `Collateral` / `FxRate` / `Threshold` / `IndependentAmount` / `Other`), free-text notes, opened-at timestamp |
| `CurveSnapshot` | append-only | Every curve publish (audit + historical reprice) |

Mature and unwind paths both produce a permanent audit record before the live workflow archives. There is no path that quietly archives a workflow without leaving a record.

## Mark cadence and call gating

Marks are produced by the `Scheduler` party on a configurable cron (`scheduler.cron.trigger`), not at end-of-day. Calls are gated by Minimum Transfer Amount and rounding before they hit the CSA:

```
exposure        = NPV(swaps in netting set, in valuationCcy)
required.fromA  = max(0, exposure - threshold.DirB)
required.fromB  = max(0, -exposure - threshold.DirA)
targetCsb       = required.fromA - required.fromB     # signed
call            = gateCall(targetCsb - currentCsb, mta, rounding)
```

`gateCall` is a no-op below `mta` and snaps to `rounding` otherwise. Bloomberg MARS / AcadiaSoft convention. Detail in [CSA Model](./concepts/csa-model).

The signed-CSB model (one per pair) makes "both sides simultaneously posted" structurally impossible. An earlier two-map iteration produced phantom calls on the wrong side; the current shape eliminates it at the contract layer.

## Dispute resolution authority

A counterparty exercises `Dispute` with a typed reason (`Valuation` / `Collateral` / `FxRate` / `Threshold` / `IndependentAmount` / `Other`), counter-mark, and optional notes. The choice persists a `Csa.Dispute:DisputeRecord` audit-trail contract and transitions the CSA to `MarkDisputed`. The CSA is **pinned out of the margin-call cycle** until one of three resolution paths runs:

| Action | Controller | Effect | Valid from |
|---|---|---|---|
| `Dispute` | partyA or partyB | Persists `DisputeRecord`, transitions to `MarkDisputed` | `Active`, `MarginCallOutstanding` |
| `AgreeToCounterMark` | counterparty (the non-disputer) | Re-publishes the mark at the disputer's claimed value, archives `DisputeRecord`, returns to `Active`. **No operator authority required** | `MarkDisputed` only |
| `EscalateDispute` | counterparty (the non-disputer) | Transitions `MarkDisputed → Escalated` and closes the bilateral exit | `MarkDisputed` only |
| `AcknowledgeDispute` | operator | Operator-arbitrated resolve. Re-publishes a fresh mark, archives `DisputeRecord`, returns to `Active` | `MarkDisputed` or `Escalated` |
| `PublishMarkByScheduler` while disputed/escalated | scheduler | No-op; CSA pinned | — |
| `SettleVm` while disputed/escalated | operator / scheduler | Asserted-out — settlement is blocked | — |

The bilateral `AgreeToCounterMark` path is the most common real-world resolution. Modeling it on-chain rather than relying on operator ack as the sole exit is the architectural reason the reference impl honors Canton's two-party-workflow positioning. `Escalated` deliberately closes the bilateral exit so the new state has on-chain meaning beyond a UI flag.

The operator is co-signatory on every CSA precisely so the operator-arbitrated path exists without requiring a fresh on-chain provisioning step. Detail in [CSA Model — Dispute taxonomy and resolution paths](./concepts/csa-model#dispute-taxonomy-and-resolution-paths).

## Separation of duties

| Action | Trader | Operator | Scheduler | Regulator |
|---|---|---|---|---|
| Propose a trade | ✓ | ✗ | ✗ | ✗ |
| Accept a trade | ✓ (counterparty) | ✗ | ✗ | ✗ |
| Manually approve trade (manual policy) | ✗ | ✓ | ✗ | ✗ |
| Hold cash / instruments | ✓ | ✗ | ✗ | ✗ |
| Publish marks | ✗ | ✓ (`PublishMark`) | ✓ (`PublishMarkByScheduler`) | ✗ |
| Trigger lifecycle | ✗ | manual fallback | ✓ (`*ByScheduler`) | ✗ |
| Settle | ✗ | manual fallback | ✓ (`Settle*ByScheduler`) | ✗ |
| Mature | ✗ | manual fallback | ✓ (`MatureByScheduler`) | ✗ |
| Resolve dispute | ✗ | ✓ | ✗ | ✗ |
| Read everything | own trades + own CSAs | reference data + queues | own work queue | everything |

Each row is enforced by a Daml `controller` clause or signatory shape. Bidirectional gating is the design intent: the operator UI hides trader actions, and the trader UI hides operator-only actions. See [Operator UI gating](./concepts/operator-role).

## Credential boundaries

Three distinct ledger JWT identities run in production:

- **Human users** authenticated via OIDC, scoped to one `orgs[].party`.
- **`mark-publisher`** service account, `actAs: [Operator]`, secret in your secrets manager.
- **`scheduler`** service account, `actAs: [Scheduler]`, separate secret.

Tokens are short-lived (default 15 min) and refreshed at 80% of TTL. Compromise of the scheduler credential cannot adjudicate disputes (different controller). Compromise of the operator credential cannot drive scheduled lifecycle (different signatory). Detail in [Service Accounts](./operations/service-accounts) and [Security & Trust](./security-and-trust).

## What's in the risk model

- **Counterparty exposure**: per-pair NPV, threshold, MTA, rounding, signed CSB.
- **Per-leg sign convention**: pay = -1, receive = +1, applied at the leg level (XCCY-correct).
- **Per-(ccy, indexId) curve book**: every cashflow discounts off the right curve regardless of how many products the trade touches.
- **DV01 and theta**: per-curve bucket sensitivities, surfaced on Workspace → Risk and Blotter exposure header.
- **CDS pricing**: maturity-anchored discount, hazard + recovery from oracle (or `demo.cdsStub`).
- **Dispute states**: `MarkDisputed` and `Escalated` pin out of the call cycle. Three resolution paths: counterparty `AgreeToCounterMark` (bilateral), counterparty `EscalateDispute` (raises severity), operator `AcknowledgeDispute` (only path out of `Escalated`). Reasons are typed (six-value `DisputeReason` enum) so back-office can slice the dispute book by category.
- **Pair-level metadata (observable)**: `isdaMasterAgreementRef`, `governingLaw`, and `imAmount` on every CSA — visible to traders and regulators, drive disclosure-grade context for who-owes-whom-under-what-MA. Initial Margin is observable-only in v1; UMR Phase 5/6 enforcement (SIMM, segregation) is integrator scope.

## What's not in the risk model (yet)

Honest gap list. These are integrator scope or planned phases, not shipped:

- **Historical / parametric VaR** (MARS does this; IRSForge stops at DV01 + scenario).
- **XVA** (CVA / DVA / FVA): out of scope.
- **Non-linear products**: swaptions, caps/floors, CMS not modeled.
- **Portfolio compression / novation**: not on-chain yet.
- **Automated alerting**: no Prometheus / OTel endpoint; on-chain pill liveness only.
- **Real credit curves**: CDS uses a flat scalar stub by default; live hazard feeds plug through the same `OracleProvider` seam as SOFR.
- **Real FX feed in production profile**: same seam; demo uses `demo.fxSpots`.

Each gap is shaped to plug into existing seams without forking. See [Integrators](./integrators/overview) and the [SWPM/MARS parity gap list](./concepts/swpm-parity#whats-missing-vs-swpmmars-known-gaps).

## See also

- [CSA Model](./concepts/csa-model) — signed-CSB convention in depth
- [Operator Role](./concepts/operator-role) — why a third party signs every proposal
- [Swap Lifecycle](./concepts/swap-lifecycle) — propose / accept / trigger / settle / mature / unwind
- [Pricing & Curves](./concepts/pricing-and-curves) — sign conventions, multi-currency curve book
- [Compliance & Audit](./compliance-and-audit) — regulator pattern, ISDA conventions, paper-trail
- [Security & Trust](./security-and-trust) — credential and trust boundaries
