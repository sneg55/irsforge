---
title: CSA Model
---

# CSA Model

The Credit Support Annex (CSA) governs **variation margin** between a pair of counterparties. IRSForge implements the **signed Credit Support Balance (CSB)** convention used by Bloomberg MARS, AcadiaSoft, and real ISDA CSAs.

## One CSA per pair

There is exactly **one** `Csa` contract per `(partyA, partyB)` pair, signed jointly by `operator`, `partyA`, `partyB`, with `regulators` and `scheduler` as observers. It's created at init time from `irsforge.yaml` (see [Demo vs Production](./demo-vs-production)). The operator is co-signatory because dispute adjudication requires non-trader authority — see [Operator Role](./operator-role).

## Signed Credit Support Balance

The CSA tracks **one signed per-currency balance**, `csb`, representing net collateral A has pledged toward B:

- `csb > 0` ⇒ A is the pledgor, B holds the collateral
- `csb < 0` ⇒ B is the pledgor, A holds the collateral
- `csb == 0` ⇒ no pledge outstanding

### Why signed (not two-map)

An earlier iteration tracked `postedByA` and `postedByB` separately. That admitted a state — both sides simultaneously posted — that real CSAs never reach, and produced **phantom margin calls on the wrong side** when one side over-posted. The signed model is the same one Bloomberg MARS exposes; it makes "both sides posted" structurally impossible.

The TS shim at `app/src/features/csa/decode.ts` derives `postedByA` / `postedByB` from the signed CSB so existing UI components keep working without each one knowing the convention.

## Parameters (from `csa:` block)

| Field | Meaning |
|---|---|
| `threshold.{DirA,DirB}` | Per-direction tolerance — exposure within threshold ⇒ no call |
| `mta` | Minimum Transfer Amount — calls below this are gated to zero |
| `rounding` | Call increment — non-zero calls are snapped to the nearest multiple |
| `valuationCcy` | Single reporting currency for the CSA |
| `eligibleCollateral[]` | Whitelist of `{ currency, haircut }` — Phase 5 ships `haircut == 1.0` |

## Production metadata fields

Three additional fields on the `Csa` template (and mirrored on `CsaProposal`) capture pair-level legal/regulatory metadata. Shipped 2026-04-29 (commit `49ed720`):

| Field | Type | Meaning |
|---|---|---|
| `isdaMasterAgreementRef` | `Text` | Identifier of the signed ISDA Master Agreement that governs this CSA (and every other CSA / swap between the same pair). Free-text on chain — IRSForge does not validate the format. |
| `governingLaw` | `NewYork \| English \| Japanese` | Legal regime that governs disputes under this CSA. Enum on chain so the value is type-safe. |
| `imAmount` | `Decimal` | Pair-level Initial Margin. **Observable but not enforced** in v1 — regulator + UI display it; posting/withdraw flows still operate on VM as today. UMR Phase 5/6 enforcement (SIMM shock buckets, segregation-aware posting) is deferred. |

ISDA MA references are pair-level — banks sign one MA per counterparty pair (per jurisdiction) and reference it across every trade beneath it. IRSForge surfaces this through a [`masterAgreements:` YAML registry](../reference/config-yaml#masteragreements): the proposal modal pins the reference + governing law as read-only when the pair has an entry, falls back to free-text otherwise. The Daml field stays `Text` regardless — the registry is purely a UI / config layer that prevents fat-finger errors and locks the law selection to whatever the MA actually specifies.

## Margin call computation

```
exposure = NPV(swaps in netting set, valued in valuationCcy)
required.fromA = max(0, exposure - threshold.DirB)
required.fromB = max(0, -exposure - threshold.DirA)
targetCsb      = required.fromA - required.fromB     # signed
call           = gateCall(targetCsb - currentCsb, mta, rounding)
```

`gateCall` is a no-op below `mta` and snaps to `rounding` otherwise.

## Lifecycle states

| State | Meaning | Recoverable by |
|---|---|---|
| `Active` | Normal operation | — |
| `MarginCallOutstanding` | Call published, awaiting post | Pledgor posts (`PostCollateral`) |
| `MarkDisputed` | One side disputed the latest mark; bilateral resolution still on the table | Counterparty (`AgreeToCounterMark`), counterparty (`EscalateDispute`), or operator (`AcknowledgeDispute`) |
| `Escalated` | Resolution Time elapsed or counterparty wants formal review; bilateral exit is closed | Operator only (`AcknowledgeDispute`) |
| `Terminated` | CSA closed (all swaps matured/unwound) | — |

State machine note: only states that **need human recovery** gate re-entry. An earlier bug asserted `state == Active` in the choice that produced `MarginCallOutstanding`, pinning the CSA forever — fixed by gating only on `MarkDisputed` / `Escalated`. No choice gates on a state it itself produces, so trap-state pinning is structurally impossible.

## Choices

Defined on `Csa.Csa.Csa` (`contracts/src/Csa/Csa.daml`). Dispute helper bodies live in `Csa.DisputeOps` — same pattern as `Csa.Math` — to keep the template file under the 300-line cap.

| Choice | Controller | Effect |
|---|---|---|
| `PostCollateral` | poster (A or B) | Increments signed CSB in poster's direction |
| `WithdrawExcess` | either party | Decrements CSB if over-collateralised |
| `PublishMark` | operator | Records new mark, computes call, may flip state to `MarginCallOutstanding` |
| `PublishMarkByScheduler` | scheduler | Same body as `PublishMark`, scheduler-driven (sister choice — Daml 2.x has no disjunctive controllers) |
| `SettleVm` | operator | Transfers pledged collateral to satisfy the call. Blocked while state is `MarkDisputed` or `Escalated` |
| `SettleVmByScheduler` | scheduler | Sister choice |
| `Dispute` | disputer (A or B) | Persists a `DisputeRecord` (reason, counterMark, notes), transitions to `MarkDisputed`. Allowed from `Active` or `MarginCallOutstanding` |
| `EscalateDispute` | counterparty (the non-disputer) | Transitions `MarkDisputed → Escalated`. Closes the bilateral exit |
| `AgreeToCounterMark` | counterparty (the non-disputer) | Re-publishes the mark at the disputer's `counterMark`, archives the `DisputeRecord`, returns to `Active`. Only valid in `MarkDisputed` |
| `AcknowledgeDispute` | operator | Operator-arbitrated resolve. Valid from `MarkDisputed` or `Escalated`; archives the `DisputeRecord` and returns to `Active` |

## Dispute taxonomy and resolution paths

### Reason taxonomy

`DisputeReason` is a six-value enum aligned with ISDA §5 / AcadiaSoft / TriOptima practice:

| Value | Meaning |
|---|---|
| `Valuation` | Mark-to-market disagreement (most common) |
| `Collateral` | Eligible collateral / haircut disagreement (renamed from `EligibleCollateral` to avoid a Daml namespace collision with the `EligibleCollateral` record type) |
| `FxRate` | Valuation FX disagreement |
| `Threshold` | Threshold or MTA calc dispute |
| `IndependentAmount` | IM-related dispute (slot for v1; no IM posting flow yet) |
| `Other` | Anything else; pair with `notes` for context |

The reference impl carries the `IndependentAmount` slot even though Tier 1 #2 shipped IM as observable-only — reserves the enum slot so the first IM-posting integration doesn't fork the type on day one.

### `DisputeRecord` audit trail

Each open dispute creates a separate `Csa.Dispute:DisputeRecord` contract:

- **Signatory:** operator. **Observers:** partyA, partyB, regulators, scheduler.
- **Payload:** `disputer`, `counterMark`, `reason`, `notes`, `openedAt`, plus a `csaCid` Text back-reference (matches `Csa.Mark.MarkToMarket` and `Csa.Shortfall.MarginShortfall` precedent — avoids the mutual import a typed back-reference would force).
- **Lifetime:** archived on resolution (`AgreeToCounterMark` or `AcknowledgeDispute`). The regulator timeline reads the archive event for the `DisputeResolved` business event.

The `Csa` template carries `activeDispute : Optional (ContractId DisputeRecord)` as a pointer for cheap on-Csa lookups while a dispute is open. The cid stays valid for the lifetime of the episode — `DisputeRecord` has no consuming choices, so it doesn't rotate.

### Resolution paths

Three on-chain exits from `MarkDisputed`, two from `Escalated`:

```
Active ──Dispute──▶ MarkDisputed ──AgreeToCounterMark (counterparty)──▶ Active
                          │                                              ▲
                          ├──AcknowledgeDispute (operator)───────────────┤
                          │                                              │
                          └──EscalateDispute (counterparty)──▶ Escalated ┘
                                                                  │
                                  (no AgreeToCounterMark from here ─ operator-only exit)
                                  AcknowledgeDispute (operator) ───────▶ Active

MarginCallOutstanding ──Dispute──▶ MarkDisputed (then same as above)
```

`AgreeToCounterMark` is the bilateral-resolution path: the counterparty accepts the disputer's claimed mark, a fresh `MarkToMarket` is published at that value, the `DisputeRecord` archives, state returns to `Active`. No operator authority required. This is the most common real-world resolution and the architectural reason the reference impl ships it on-chain rather than relying on operator ack as the sole exit — a Canton derivatives platform whose dispute model can only resolve through a trusted operator silently contradicts Canton's two-party-workflow positioning.

`Escalated` deliberately closes `AgreeToCounterMark`. Once formally escalated (Resolution Time elapsed in real CSAs), only the operator clears the state. This gives the new state on-chain meaning beyond a UI flag: the regulator timeline distinguishes "in dispute for an hour" from "elapsed Resolution Time and we're escalating," matching what a tier-1 desk's back office tracks.

## Contract identity

Every choice **rotates the `ContractId`** (Daml templates are immutable). Frontend code must look up the CSA by **stable pair key** (`partyA + partyB`), not by cached cid. Mutating choices use `exerciseCsaWithRetry` (`app/src/features/csa/ledger/csa-actions.ts`) which retries on `CONTRACT_NOT_FOUND` to handle racing rotations.

## Production hardening

For live multi-tenant onboarding, use the **`CsaProposal`** template (`Csa.Proposal:CsaProposal`). It mirrors the `CdsProposal` pattern:

- **Signatories:** proposer + operator (both must authorize creation)
- **Observers:** counterparty + regulators
- **Choices:** `Accept` (counterparty agrees, CSA is created), `Reject` (counterparty declines), `Withdraw` (proposer retracts before acceptance)

The init-time `submitMulti [partyA, partyB, operator]` path remains available for sandbox and reference deployments. The Operator console exposes the proposal workflow UI — see [Operator view](../ui/operator).
