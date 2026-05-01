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

## Maturity anchor

CDS pricing uses `maturityDate` as the discount anchor — not `today` — so the present value remains stable across days as the trade ages. XCCY theta is filtered to the in-currency leg to avoid double-counting.

## Where this lives

- Pricing engine: `shared-pricing/` (vitest suite via `make test-pricing`)
- Strategies per family: `shared-pricing/src/strategies/*`
- Curve fetch + cache: `app/src/features/workspace/hooks/use-pricing.ts`
- On-chain curve templates: `contracts/src/Oracle/`
