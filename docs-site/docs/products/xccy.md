---
title: XCCY — Cross-Currency Swap
sidebar_label: XCCY
---

# XCCY

Two-currency swap. Each leg is denominated in its own currency; notional exchange at start and maturity, plus per-leg coupons.

## Economics

| Field | Default |
|---|---|
| Frequency | semi-annual (every 6 months, Act/360) |
| Leg A (fixed) | USD fixed |
| Leg B (float) | EUR float (EUR-ESTR) |
| Notional exchange | initial + final |

```yaml
scheduleDefaults:
  XCCY: { frequencyMonths: 6, dayCountConvention: Act360 }
```

The shipped variant is **fixed/float** (`Swap.XccyFixedFloatProposal:XccyFixedFloatProposal`). Fix/fix `Swap.CcySwapProposal` lives in the codebase but is hidden from the workspace selector (`observables.CCY: { enabled: false }` in `irsforge.yaml`). A float/float variant is not shipped — it would be an additive Daml template modeled on `XccyFixedFloatProposal`; the pricing strategy is already leg-variant-agnostic, so the engine, scheduler, and settlement chain do not need to change.

## On-chain template

Created via the FpML factory — same multi-stream pattern as Basis. The Accept choice writes two notional-exchange events (start + maturity) plus the per-leg coupons.

## FX

Cross-currency NPV is reported in a single currency (the CSA's `valuationCcy`). Each leg's per-ccy NPV is translated through `Oracle.FxSpot`:

```yaml
demo:
  fxSpots:
    EURUSD: 1.08
```

In production a live FX feed publishes `FxSpot` updates.

## Oracle inputs

- Two discount curves (one per leg currency).
- Two projection curves (one per float index).
- An FX spot per `(domestic, foreign)` pair.

## Pricing gotchas

- **Curve book** must be keyed by `(currency, indexId)` — a single XCCY trade pulls from four curves; a flat curve cache returns the wrong one.
- **Theta** is filtered to the in-currency leg only — otherwise FX P&L gets double-counted.
- **Per-leg direction** matters: each leg has its own Pay/Receive sign.

These were the 2026-04-21 pricing-correctness fixes.
