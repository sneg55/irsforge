---
title: Blotter
sidebar_label: Blotter
---

# Blotter (`/org/[orgId]/blotter`)

**Purpose:** all positions across the active party, plus exposure summary and FpML interchange.
**Who uses it:** traders, risk, ops.
**MARS analog:** this is the MARS portfolio blotter — positions, NPV, DV01, exposure header. See [SWPM / MARS parity](../concepts/swpm-parity).
**Source:** `app/src/features/blotter/`.

![Blotter — full table](/img/ui/blotter/blotter--full.png)

## Exposure header

Top of page. Aggregates across all open swaps in the active party's netting set.

| Cell | Meaning |
|---|---|
| **Notional** | Σ notional by currency |
| **NPV** | Σ NPV in CSA reporting ccy |
| **Collateral** (zone) | Posted vs required, signed CSB direction |
| **Scheduler pill** | ON / OFF — pings oracle health |

![Blotter — exposure header](/img/ui/blotter/blotter--exposure-header.png)

## Swap table columns

| Column | Source |
|---|---|
| Family | `IRS` / `OIS` / `BASIS` / `XCCY` / `CDS` |
| Direction | Pay / Receive (red / green) |
| Notional + ccy | Trade payload |
| Tenor / Maturity | Trade dates |
| Coupon / Spread | Per-leg config |
| **NPV** | Live from pricing engine |
| **Trend** | Sparkline from `CurveSnapshot` history |
| Status | Proposed / Active / Disputed / Matured |

Rows are clickable — opens the **row drawer**.

## Row drawer

![Blotter — row drawer](/img/ui/blotter/blotter--row-drawer.png)

Shows full trade payload, lifecycle history (events), and per-period cashflows. Actions depend on role + state:

| Action | Visible to | When |
|---|---|---|
| Accept proposal | counterparty | proposal-state, you are the counterparty |
| Reject proposal | counterparty | proposal-state, you are the counterparty |
| Withdraw proposal | proposer | proposal-state, you are the proposer |
| **Trigger lifecycle** (manual) | operator | demo only (`scheduler.manualOverridesEnabled: true`) |
| **Settle** (manual) | operator | demo only |
| **Mature** (manual) | operator | demo only |
| Export FpML | any | always — downloads FpML XML |

## FpML import / export

- **Import** — top-bar button on the workspace, accepts FpML XML, hydrates as a draft.
- **Export** — per-row drawer action; emits Daml-Finance-equivalent FpML XML.

See [FpML Import / Export](./fpml-import-export).

## Filters

(Top of table — TODO if/when we add filter chips.)

## Configurable via yaml

| yaml key | UI effect |
|---|---|
| `observables.*.enabled` | Hides products from the family filter |
| `scheduler.manualOverridesEnabled` | Hides Trigger / Settle / Mature buttons |
| `csa.valuationCcy` | Currency for NPV and Collateral cells |
