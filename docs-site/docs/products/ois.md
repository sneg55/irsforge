---
title: OIS — Overnight Index Swap
sidebar_label: OIS
---

# OIS

Overnight Index Swap. Single annual settlement; float leg compounds an overnight index (SOFR, ESTR) over the period.

## Economics

| Field | Default |
|---|---|
| Frequency | **Annual** (Act/360) |
| Float index | USD-SOFR (`compounding: CompoundedInArrears`, `lookback: 2`) |
| Fixed leg | annual coupon |

```yaml
scheduleDefaults:
  OIS: { frequencyMonths: 12, dayCountConvention: Act360 }
```

## On-chain template

Proposal: `Swap.OisProposal`. Accept choice: `OisAccept`.

## Float-leg semantics

The float coupon for `[start, end]` is computed from the SOFR Index:

```
coupon = Index(end) / Index(start) - 1
```

Daml Finance's `CompoundedIndex Act360` handles this automatically — **but** observations must be Index values, not raw rates. See [SOFR Service](../oracle/sofr-service).

## Oracle inputs

- USD or EUR discount curve.
- USD-SOFR or EUR-ESTR projection curve.
- Daily SOFR/ESTR Index observations.

## Use cases

OIS rates are the standard collateralised discount curve in modern derivatives — IRSForge uses the same projection curves for OIS pricing and for IRS / Basis discounting.
