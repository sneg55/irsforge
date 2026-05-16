---
title: Workspace
sidebar_label: Workspace
---

# Workspace (`/org/[orgId]/workspace`)

**Purpose:** pre-trade pricing surface — compose a swap, see live NPV / cashflows / risk, then propose it on-chain.
**Who uses it:** traders.
**SWPM analog:** this *is* `SWPM <GO>` — leg composer, product tabs, Cashflows / Risk / Solver / Attribution tabs all map one-to-one. See [SWPM / MARS parity](../concepts/swpm-parity).
**Source:** `app/src/features/workspace/`.

![Workspace — IRS composer](/img/ui/workspace/workspace--irs-composer.png)

## Top bar

| Control | Action | Notes |
|---|---|---|
| Product tabs (IRS / OIS / BASIS / XCCY / CDS) | Switches active product family | Filtered by `observables.*.enabled` in config |
| Trade / Eff / Mat dates | Editable dates | Recalc each other; respects `roll convention` |
| Tenor | Editable tenor (e.g. `5Y`) | Drives Mat from Eff |
| **Import FpML** | Opens import modal | Draft-mode only |
| **What-If toggle** | Switches to scenario mode | Visible when viewing a live position |

## Leg composer

Each leg has:

- **Direction** — Pay / Receive (red / green pill)
- **Notional** + currency
- **Schedule** — frequency, day-count, roll convention
- **Rate** — fixed coupon, or floating index + spread

For multi-leg products (XCCY, BASIS) two `LegColumn`s render side-by-side.

## Reference strip

Right side of the top bar:

- **SOFR tile** — current SOFR Index value, hover for popover with recent history
- **CSA tile** — link to the active CSA between the displayed counterparties

![Workspace — reference strip](/img/ui/workspace/workspace--reference-strip.png)

## Right panel — tabs

| Tab | What it shows |
|---|---|
| **Valuation** | NET VALUATION cluster: NPV (with currency suffix derived from the first leg with a currency), Par Rate, DV01 labelled `(<ccy> / bp)`, Mod Duration labelled `(years)`, Convexity. Per-leg PV + accrued. Cashflow tables for each leg. |
| **Risk** | DV01, theta, per-curve sensitivities |
| **Solver** | Solve for fair coupon (sets NPV = 0); What-If mode |
| **Attribution** | P&L attribution drawer — what moved NPV since last mark |
| **On-chain** | Raw Daml payload preview; "Propose" button for draft trades. The short contract ID in the panel header is a clickable chip — click to jump into the [Ledger](./ledger) drawer for that contract's full event lineage. |

The reporting currency on the Valuation cluster is derived from `SwapConfig.legs[]` (first leg with a `currency` field, fallback `'USD'`). Protection (CDS) and asset legs have no leg currency and inherit the USD fallback — open a follow-up if a non-USD CDS/asset family lands.

![Workspace — risk tab](/img/ui/workspace/workspace--risk-tab.png)

## Modes

- **Draft** — pre-trade, all fields editable, "Propose" enabled.
- **Live** — viewing a proposed/accepted swap, editing disabled, "What-If" toggle enabled.
- **What-If** — temporary draft built from a live position; doesn't persist on-chain.

## Configurable via yaml

| yaml key | UI effect |
|---|---|
| `observables.<family>.enabled` | Hides product tab when `false` |
| `currencies[]` | Populates currency dropdowns |
| `floatingRateIndices.*` | Populates float-index dropdowns |
| `scheduleDefaults.<family>` | Initial frequency + day-count when picking a family |
| `cds.referenceNames[]` | Populates CDS reference name dropdown |
