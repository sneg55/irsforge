---
title: Pricing & Curves
---

# Pricing & Curves

## Curve architecture

Two on-chain templates back the curve system:

| Template | Cardinality | Purpose |
|---|---|---|
| `Oracle.Curve` | One per `(currency, kind)` — keyed, archive-on-publish | Latest discount/projection curve |
| `Oracle.CurveSnapshot` | Append-only | Audit log + sparkline history |

A "curve" is a sequence of `(tenorDays, zeroRate)` pillars under an `interpolation` strategy (`LinearZero` is the default). Discount factors are interpolated per tenor; projection curves additionally carry an `indexId` (e.g. `USD-SOFR`).

### Why two templates

Canton's `PublishDiscountCurve` archives the previous `Curve` contract on every publish. The ACS holds **exactly one** curve per key — without `CurveSnapshot`, the frontend's `useCurveStream` would never see more than a single point.

`useCurveStream` merges:
1. `CurveSnapshot` ACS query (history)
2. Live Canton WebSocket (deltas)
3. localStorage mirror (page refresh resilience)

## Per-(ccy, indexId) curve book

The pricing engine keeps a **curve book** keyed by `(currency, indexId)` so a single trade can discount cashflows off the right curve regardless of how many products it touches.

This was a pricing-correctness fix (2026-04-21): pricing strategies must resolve discount off `ctx.book`, not `ctx.curve`. The latter only holds the most recently fetched curve and produced wrong NPVs on multi-currency trades.

## Floating-rate indices

Configured under `floatingRateIndices:`:

```yaml
USD-SOFR:
  currency: USD
  family: SOFR
  compounding: CompoundedInArrears
  lookback: 2
  floor: 0.0
```

| Field | Meaning |
|---|---|
| `family` | `SOFR`, `ESTR`, `LIBOR`, ... |
| `compounding` | `CompoundedInArrears`, `OvernightAverage`, `Simple`, ... |
| `lookback` | Days lookback for in-arrears compounding |
| `floor` | Optional rate floor; `null` = no floor |

## CompoundedIndex semantics (gotcha)

Daml Finance's `CompoundedIndex Act360` interprets each `Observation` as a **cumulative compounded index value**, not a raw overnight rate. Coupon for a period is:

```
coupon = obs(end) / obs(start) - 1
```

If you publish raw rates and read them as `CompoundedIndex`, the math silently produces nonsense.

For raw overnight rates, use a different `referenceRateType` or publish proper Index values.

## NPV by family

```
IRS / OIS / BASIS:
  NPV = sum over cashflows of (DF(t) * notional * rate(t) * accrual(t))
       + per-leg sign (pay/receive)

XCCY:
  NPV per leg in its own ccy
  Reported NPV = sum of legs translated via FxSpot to reporting ccy

CDS:
  NPV = premium_leg_PV - contingent_leg_PV
  contingent_leg uses (defaultProb, recovery) from demo.cdsStub or live credit curve
```

## Per-leg direction

Pricing-correctness fix: NPV must be aggregated with **per-leg direction** (`Pay = -1`, `Receive = +1`), not flipped at the trade level. Multi-leg products (XCCY especially) had silent sign errors before this.

## Viewer-relativity

The engine is **viewer-agnostic**. `pricingEngine.price()` multiplies each leg PV by its `directionSign` (`pay = -1`, `receive = +1`) using the leg-direction labels in the `SwapConfig`. Those labels are anchored to **one side** of the trade — for IRS/OIS the workspace builds the config with fixed='receive' / float='pay', which gives an NPV from the receive-fixed party's perspective.

If both counterparties read that NPV unchanged, they see the same signed value on the same trade — fine for a static-mark service, wrong for a derivatives platform where each side has their own P&L. The fix lives at the **row-mapper boundary** (`app/src/features/blotter/workflow-to-row.ts`) rather than inside the engine:

```ts
const direction = getInstrumentDirection(instr, isPartyA)
const viewerSign = instr && direction === 'pay' ? -1 : 1
const npv = valuation.npv * viewerSign
const dv01 = valuation.dv01 * viewerSign
const sparkline = valuation.sparkline?.map((v) => v * viewerSign)
```

Result: Goldman's BOOK RISK NPV is the exact negative of JPMorgan's BOOK RISK NPV on the same set of trades, and rows mirror cell-by-cell.

The engine stays viewer-agnostic so oracle, scripts, and any future PQS projection consumer can reuse it without knowing who's looking. Operator and regulator views read the row with `isPartyA === false` (their hint matches neither side), so they see the engine's natural sign — for the regulator's canonical surface (`/oversight`) we surface the pair-level MTM directly rather than per-trade NPV.

A symmetry regression test lives in `app/src/features/blotter/__tests__/workflow-to-row.test.ts` — renders the same trade with each party as viewer and asserts NPV/DV01/sparkline come out exact negatives. Extend it when adding a new product family.

## Maturity anchor

CDS pricing uses `maturityDate` as the discount anchor — not `today` — so the present value remains stable across days as the trade ages. XCCY theta is filtered to the in-currency leg to avoid double-counting.

## Where this lives

- Pricing engine: `shared-pricing/` (vitest suite via `make test-pricing`)
- Strategies per family: `shared-pricing/src/strategies/*`
- Curve fetch + cache: `app/src/features/workspace/hooks/use-pricing.ts`
- On-chain curve templates: `contracts/src/Oracle/`
