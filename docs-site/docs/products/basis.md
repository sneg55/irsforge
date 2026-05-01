---
title: Basis Swap
sidebar_label: Basis
---

# Basis

Single-currency swap where **both legs are floating**, indexed to different rate families.

In IRSForge the demo Basis is **SOFR vs EFFR**:

| Leg | Index |
|---|---|
| Leg A | USD-SOFR (`CompoundedInArrears`) |
| Leg B | USD-EFFR (`OvernightAverage`) |

## Economics

```yaml
scheduleDefaults:
  BASIS: { frequencyMonths: 3, dayCountConvention: Act360 }

floatingRateIndices:
  USD-SOFR: { family: SOFR, compounding: CompoundedInArrears, lookback: 2, floor: 0.0 }
  USD-EFFR: { family: SOFR, compounding: OvernightAverage,    lookback: 0, floor: null }
```

The two indices share the same currency (USD), so notional is single-currency. Spread between SOFR and EFFR is typically 1–10 bps.

## On-chain template

Created via the **FpML factory** (`Swap.FpmlProposal` → `FpmlAccept`) — Basis and XCCY share this generic multi-stream path. The factory consumes the leg definitions and produces an Instrument with two float streams.

## Oracle inputs

- USD discount curve.
- USD-SOFR projection curve.
- USD-EFFR projection curve (separately seeded under `demo.stubCurves.USD.projections.USD-EFFR`).

A live EFFR feed is Phase 9 — until then EFFR is a demo-stub curve with the front-end +5bp basis baked in.

## Pricing

```
NPV = PV(SOFR leg, Receive) − PV(EFFR leg, Pay)
```

Per-leg direction is critical here — both legs are floating, so a sign flip silently halves or doubles the NPV.
