---
title: SWPM / MARS parity
sidebar_label: SWPM / MARS parity
---

# SWPM / MARS parity

IRSForge is designed as a **fully on-chain alternative to Bloomberg SWPM and MARS** — the two tools every rates desk and counterparty-risk team already lives in. Non-technical users who know SWPM should be able to sit down in IRSForge and feel at home within minutes.

This page is the mapping: **what SWPM/MARS calls it → what IRSForge calls it → where to find it**.

## Why SWPM/MARS as the reference

- **SWPM** (`SWPM <GO>` on a Bloomberg Terminal) is the universal swap pricer. IRS, OIS, basis, cross-currency, CDS. Trade ticket, cashflows, risk, scenario, historical mark.
- **MARS** (`MARS <GO>`) is Bloomberg's Multi-Asset Risk System. Portfolio-level NPV, DV01, VaR, P&L attribution, CSA netting, margin calls.
- Together they cover **>90% of the day-to-day workflow** of a rates trader, a risk manager, and a collateral operations desk.

If a task can be done in SWPM+MARS, the goal is for it to be doable in IRSForge — same concepts, same keystrokes where feasible, same numbers to four decimals. The difference is the state lives on the Canton ledger instead of a Bloomberg silo.

## Feature map — SWPM → IRSForge

| SWPM screen / tab | IRSForge surface | Notes |
|---|---|---|
| Main deal screen (leg composer) | [Workspace](../ui/workspace) → leg composer | Pay/Receive pills, direction colors, tenor/roll/dcf all match SWPM conventions |
| Product tabs (IRS/OIS/Basis/XCCY/CDS) | Workspace top-bar product tabs | Same five families, same default conventions |
| `CASHFLOWS` tab | Workspace → **Cashflows** tab | Per-period: fixing, accrual, DF, PV — same columns, same sign convention |
| `CURVES` tab | [Pricing & Curves](./pricing-and-curves) + SOFR tile | Curves are on-ledger `Curve`/`CurveSnapshot` contracts, not Bloomberg feeds |
| `RESETS` / fixings | Workspace cashflows + on-ledger `Observation` | Fixings are signed Daml contracts, auditable per-row |
| `RISK` tab | Workspace → **Risk** tab | DV01, theta, per-curve bucket sensitivities |
| `SCENARIO` / What-If | Workspace → **Solver** / What-If toggle | Shift a curve, reshock, compare NPV deltas; doesn't persist on-chain |
| `SOLVE` (fair coupon) | Workspace → **Solver** tab | Solve for coupon that zeroes NPV |
| `ATTRIB` / P&L attribution | Workspace → **Attribution** drawer | What moved NPV since last mark: curve, time, carry |
| `DES` (deal description) | Workspace → **On-chain** tab (payload preview) | Raw Daml payload + cid → the authoritative deal description |
| FpML in/out (`XSWP`-style) | [FpML import/export](../ui/fpml-import-export) | Round-trips industry-standard FpML 5.x |
| Confirmation / ticket | On-chain `Accept` choice | Counterparty acceptance is a Daml choice, not a PDF confirmation |

## Feature map — MARS → IRSForge

| MARS screen | IRSForge surface | Notes |
|---|---|---|
| Portfolio blotter | [Blotter](../ui/blotter) | Positions, NPV, DV01, exposure header — same layout idioms |
| Exposure summary | Blotter → exposure header | Aggregates across counterparties and currencies |
| CSA ladder / collateral | [CSA page](../ui/csa) | Signed-CSB model, one drawer per counterparty |
| Margin call workflow | CSA drawer → Post / Dispute | Fully on-chain, no email/PDF |
| Mark history | CSA drawer → mark sparkline | Driven by `CurveSnapshot` on the ledger |
| P&L attribution | Workspace → Attribution tab | Same decomposition: curve move, carry, time decay |
| Dispute workflow | CSA drawer → **Dispute** with reason taxonomy + bilateral / escalation / operator resolution | `MarkDisputed` and `Escalated` states; six-value `DisputeReason` enum; bilateral `AgreeToCounterMark` (no operator) + counterparty `EscalateDispute` + operator `AcknowledgeDispute` |
| End-of-day marks | Oracle [scheduler](../oracle/scheduler) + `CurveSnapshot` | Continuous on-chain, not batch EOD — see [24/7 settlement](./swap-lifecycle) |

## What's **different** from SWPM/MARS (intentionally)

These are not gaps — they're where on-chain settlement changes the model:

- **No EOD batch.** The ledger is 24/7; marks, fixings, and margin updates are continuous. No "T+1" cutoff, no holiday calendar.
- **No PDF confirmations.** The `Accept` choice on a Daml contract *is* the confirmation. Auditable, cryptographically signed, no paper trail.
- **No bilateral-only counterparty data.** Every trade has a `regulator` observer by default — the audit trail is first-class, not a post-hoc CSV export.
- **No separate CSA reconciliation.** CSA is one on-chain contract with a signed CSB; phantom-call bugs are structurally impossible. See [CSA model](./csa-model).
- **No proprietary curve feed.** Curves are on-ledger `Curve` contracts signed by a named oracle party; any participant can run an oracle arm.

## What's **missing** vs SWPM/MARS (known gaps)

Honest list. These are in scope for future phases, not this hackathon release:

- **Historical VaR / CVaR** — MARS does historical/parametric VaR; IRSForge currently stops at DV01 + scenario.
- **XVA** (CVA/DVA/FVA) — out of scope; SWPM has a dedicated `XVA` tab.
- **Non-linear products** — swaptions, caps/floors, CMS. SWPM covers these; IRSForge ships linear rates + CDS only.
- **Optimizer / portfolio compression** — MARS has trade compression and novation workflows. Not yet modeled on-chain.

See [SWPM parity roadmap](https://github.com/sneg55/irsforge/issues?q=label%3Aswpm-parity) for tracked work.

## For non-technical users

If you've used SWPM/MARS and never touched a blockchain:

1. **The workspace is SWPM.** Same leg composer, same tabs, same numbers.
2. **The blotter is MARS.** Same exposure view, same P&L columns.
3. **The CSA page is the MARS collateral module.** Same ladder, same dispute flow.
4. **"Propose" and "Accept" replace the confirmation paperwork.** A click is a binding, signed, on-chain commitment.
5. **You don't need to know Canton exists** to use any of this. The on-chain layer is plumbing — the UI is the rates desk tool you already know.

That's the design target. Every time a surface deviates from SWPM/MARS muscle memory without a good on-chain reason, it's a bug.
