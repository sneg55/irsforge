---
title: Comparison
sidebar_position: 5
---

# Comparison

Where IRSForge sits relative to the tools and platforms a rates desk, a risk team, and a collateral ops team already use. Honest about both the deltas and the gaps.

## vs Bloomberg SWPM and MARS

SWPM and MARS together cover roughly 90% of the day-to-day workflow of a rates trader, a risk manager, and a collateral ops desk. IRSForge is designed as a fully on-chain alternative.

| Surface | Bloomberg SWPM / MARS | IRSForge |
|---|---|---|
| Pricing engine | Proprietary, vendor-managed | Open source, in-tree (`shared-pricing/`) |
| Leg composer | SWPM main deal screen | Workspace, same field shape |
| Cashflows tab | SWPM `CASHFLOWS` | Workspace `Cashflows` tab |
| Risk tab | SWPM `RISK` | Workspace `Risk` tab |
| Scenario / what-if | SWPM `SCENARIO` | Workspace `Solver` and what-if toggle |
| Solver (fair coupon) | SWPM `SOLVE` | Workspace `Solver` |
| Portfolio blotter | MARS portfolio | Blotter |
| CSA collateral ladder | MARS collateral module | CSA page (signed-CSB convention) |
| Margin call workflow | MARS, dispatched to AcadiaSoft | On-chain `Csa` choices, no external messaging needed |
| Mark history | MARS history pane | CSA mark sparkline driven by on-ledger `CurveSnapshot` |
| Trade reporting | MARS export, vendor-managed | Regulator as observer, ledger is the report |
| Confirmation matching | Off-platform via MarkitWire / Refinitiv | `Accept` choice on the ledger is the confirmation |
| Curves | Bloomberg feeds | On-ledger `Curve` / `CurveSnapshot`, BYO provider |
| Settlement | T+1 / T+2 against off-chain rails | On-chain, continuous, same date as the cashflow |
| Vendor lock-in | High | None: AGPL, runs on your Canton |

Detailed tab-by-tab map at [SWPM / MARS parity](./concepts/swpm-parity).

**Where IRSForge is intentionally different:** no EOD batch, no PDF confirms, no separate CSA reconciliation, regulator first-class. **Where IRSForge is weaker:** historical / parametric VaR, XVA, swaptions / caps / floors / CMS, portfolio compression. See the [SWPM/MARS parity gap list](./concepts/swpm-parity#whats-missing-vs-swpmmars-known-gaps).

## vs AcadiaSoft (collateral messaging)

AcadiaSoft is the de-facto messaging hub for variation margin between dealers. IRSForge replaces the messaging layer with on-ledger contract state.

| Concern | AcadiaSoft | IRSForge |
|---|---|---|
| Message channel | MarginSphere | On-ledger `Csa` choices |
| Reconciliation | Bilateral, message-based | None needed: one CSA contract per pair |
| Dispute workflow | Bilateral, off-platform escalation | On-ledger `Dispute` (six-value reason taxonomy + counter-mark + notes), counterparty `AgreeToCounterMark` (bilateral resolve, no operator), counterparty `EscalateDispute` (raises severity), operator `AcknowledgeDispute`. Separate `DisputeRecord` audit-trail contract |
| Authoritative state | Each side's internal book + AcadiaSoft messages | The ledger contract |
| Audit | Message logs | On-ledger record visible to regulator |
| Vendor relationship | License + per-message fees | None |

The signed-CSB convention IRSForge uses is the same one AcadiaSoft and Bloomberg MARS expose. The shape is familiar; the rail is on-chain instead of bilateral message exchange.

## vs IHS Markit / S&P Global (MarkitWire, MarkitSERV)

MarkitWire is the dominant trade-confirmation matching service for IRS. IRSForge's `Accept` choice is the on-chain analogue: counterparty acceptance is a Daml choice, signed by their party, immutable once exercised.

| Concern | MarkitWire / MarkitSERV | IRSForge |
|---|---|---|
| Match service | Centralized, per-trade fee | None needed: matching is the proposal / accept handshake |
| Affirmation latency | Same day at best, often longer | Same transaction |
| Standard format | FpML | FpML round-trip in / out |
| Downstream feeds (DTCC GTR, etc.) | Vendor-routed | Regulator-as-observer + integrator-side reporting |
| Vendor relationship | License + per-trade fee | None for matching; data licenses still apply |

FpML round-trip means a trade can move between MarkitWire and IRSForge without re-keying, which is the primary integration path during a coexistence period.

## vs CME, LCH, Eurex (cleared swaps)

Cleared swaps eliminate counterparty risk by novating to the CCP. IRSForge does not aim to replace clearing for trades that need to be cleared. It serves the **uncleared bilateral** book and the **on-chain hedging** flows that have no clearing rail.

| Concern | Cleared (CME / LCH) | IRSForge (uncleared bilateral) |
|---|---|---|
| Counterparty | CCP | Bilateral |
| Initial margin | CCP-set, SIMM or CCP model | None today; SIMM is integrator scope |
| Variation margin | CCP-collected | Bilateral CSA, signed-CSB on-chain |
| Hours | Exchange / CCP hours | 24/7 |
| Settlement | T+1 / T+2 | Same date |
| Audit | CCP, regulator-fed | On-chain, regulator-observed |
| Privacy | Public, position-revealing at CCP | Bilateral with regulator as observer |
| Trade types | What the CCP clears | Anything the on-chain templates support |
| Suitable when | Cleared mandate or capital efficiency | Uncleared book, on-chain hedge of an on-chain position |

The natural use case for IRSForge is **hedging an on-chain position with an on-chain swap**, where moving the hedge off-chain to a CCP introduces settlement risk between the on-chain leg and the off-chain hedge. Tokenized treasuries, repo books on Canton, private credit positions are the obvious cases.

## vs forking Daml Finance directly

Daml Finance ships swap factories, settlement chain, lifecycle. You could build directly on it. IRSForge is what you'd end up with after solving the same problems.

| Concern | Fork Daml Finance | IRSForge |
|---|---|---|
| Swap factories | Yes (V0) | Same factories, registered + glued |
| Proposal / accept lifecycle | You build it | Per-family proposal templates with `Accept` / `Reject` / `Withdraw`, plus manual-policy `ProposeAccept` / `AcceptAck` |
| Scheduler authority | You design it | Sister `*ByScheduler` choices closing the Daml-2.x disjunctive-controller gap |
| CSA model | You design it | Signed-CSB per pair, Bloomberg / AcadiaSoft / ISDA convention |
| Oracle pattern | You design it | `Oracle.Interface.Provider` extension, two reference providers in-tree |
| FpML | You build it | Round-trip ships |
| Pricing engine | You build it | `shared-pricing/` with strategies per family |
| Frontend | You build it | Next.js + React 19 SWPM-shaped UI |
| Auth bridge | You build it | RS256 JWKS auth service with OIDC support |
| Time to running demo | Months | `make demo` |
| Time to deployable production shape | 6 to 12 months | YAML edit per [Deploying Production](./operations/deploying-production) |

If you fork IRSForge, you inherit all of the above and can change any of it. If you fork Daml Finance, you build all of the above.

## vs building proprietary on Canton

| Concern | Build proprietary | IRSForge |
|---|---|---|
| Engineering effort | 6 to 12 months minimum | YAML + adapters |
| Daml expertise required | Deep | Read-only at first; deeper for new families |
| Daml Finance interface evolution | Your problem | IRSForge tracks it |
| Audit / regulator pattern | You design it | Built in |
| Canton expertise required | Deep | Standard participant config |
| Vendor lock-in | None (you wrote it) | None (AGPL) |
| Reusability across firms | None | Reference implementation, designed for plurality |

The point of a reference implementation is that you do not have to build this. AGPL is intentional: if you operate IRSForge as a service to third parties, your modifications go back to the commons.

## vs staying off-chain (status quo)

If the desk's positions are not on Canton, the question is whether to put any flow on Canton at all. IRSForge does not answer that question. It answers "**if** you have on-chain positions, how do you hedge them on-chain". Hedging an on-chain position with an off-chain instrument introduces settlement risk between the two legs, which is the disconnect IRSForge closes.

For desks with no on-chain exposure today, the typical path is to wait until tokenized treasury / repo / private-credit volumes cross a threshold that justifies an on-chain hedge. The same desks then evaluate IRSForge alongside Bloomberg MARS as the desk-side surface.

## Summary table

| Concern | IRSForge | Fork Daml Finance | Build proprietary | Stay off-chain |
|---|---|---|---|---|
| Time to deploy | YAML + OIDC | Months | 6 to 12 months | N/A, already there |
| ISDA-shaped templates | Daml Finance V0 + FpML round-trip | Inherited | Up to you | Yes, off-chain |
| FpML 5.x round-trip | Yes | Manual | Manual | Through clearer / vendor |
| 24/7 settlement | Yes | Yes (you wire it) | If you build it | No |
| Sub-transaction privacy | Canton | Canton | Canton | No |
| Open source | AGPL v3.0 | Apache 2.0 (Finance only) | No | No |
| Canton-native | Out of box | Yes (you wire it) | Yes (you wire it) | No |
| Vendor lock-in | None | None | None | High |

## See also

- [SWPM / MARS parity](./concepts/swpm-parity): feature-by-feature map
- [Risk & Controls](./risk-and-controls): controls relative to MARS / AcadiaSoft conventions
- [Compliance & Audit](./compliance-and-audit): regulator pattern vs trade-reporting vendors
- [BYO Integrators](./integrators/overview): what you wire when you adopt
- [FAQ](./faq): procurement-grade answers
