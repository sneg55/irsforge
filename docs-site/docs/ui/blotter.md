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
| Direction | Pay / Receive (red / green) for traders; pair-aware leg detail for operator / regulator viewers |
| Notional + ccy | Trade payload; compact form (`$10M`, `€25M`) — same shape across blotter, regulator oversight, and operator surfaces |
| Tenor / Maturity | Trade dates |
| Coupon / Spread | Per-leg config |
| **NPV** | Live from pricing engine — **viewer-relative** (see below) |
| **DV01** | Same sign convention as NPV |
| **Trend** | Sparkline from `CurveSnapshot` history, sign-aligned to the viewer's NPV |
| Status | Proposed / Active / Disputed / Matured |

Rows are clickable — opens the **row drawer**.

### Viewer-relative NPV

NPV, DV01, and the trend sparkline are flipped at the row-mapper boundary (`app/src/features/blotter/workflow-to-row.ts`) so that bilateral counterparties read **mirror-image MTM on the same trade** — if Goldman shows `+$9.5M` on the BOOK RISK tile, JPMorgan shows `−$9.5M`. The pricing engine itself is viewer-agnostic; the flip lives in the UI layer.

See [pricing & curves — viewer-relativity](../concepts/pricing-and-curves#viewer-relativity) for the architectural detail and the symmetry test that locks the invariant.

### Valuation-stale banner

When any input curve has aged past the staleness threshold (default 10 min, configurable via `app/src/features/operator/hooks/use-curve-staleness.ts::CURVE_STALENESS_MINUTES`), a yellow banner appears above the table naming the affected curves (e.g. "USD USD-EFFR"). NPV / DV01 on rows that depend on those curves can drift until the publisher catches up.

In demo profile the [demo curve ticker](../oracle/demo-curve-ticker) refreshes every seeded projection (including secondary indices like USD-EFFR) every 10s, so the banner should stay hidden unless the oracle service is down.

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
