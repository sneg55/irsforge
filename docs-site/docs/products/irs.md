---
title: IRS — Interest Rate Swap
sidebar_label: IRS
---

# IRS

Vanilla single-currency interest rate swap. One leg pays a **fixed** rate, the other pays a **floating** rate (e.g. SOFR) on the same notional.

## Economics

| Field | Default |
|---|---|
| Notional | user-defined |
| Currency | USD or EUR (config-driven) |
| Fixed leg | annual coupon, Act/360 |
| Float leg | quarterly, Act/360, USD-SOFR (compounded in arrears) |
| Tenor | 1Y / 2Y / 5Y / 10Y typical |

Per-product schedule defaults from `irsforge.yaml`:

```yaml
scheduleDefaults:
  IRS: { frequencyMonths: 3, dayCountConvention: Act360 }
```

## On-chain template

Proposal: `Swap.IrsProposal`. On `IrsAccept`, the Daml Finance factory chain creates an `Instrument` with two leg streams.

## Lifecycle

Standard 5-stage flow — see [Swap Lifecycle](../concepts/swap-lifecycle).

## Oracle inputs

- **Discount curve** for the trade currency (`curves.currencies.<ccy>.discount`).
- **Projection curve** for the float index (`curves.currencies.<ccy>.projection`).
- **Index observations** for the float leg, published as Index values per [SOFR Service](../oracle/sofr-service).

## Pricing

```
NPV = PV(fixed leg) − PV(float leg)        (from Pay side)
PV(leg) = Σ DF(t) × notional × rate(t) × accrual(t)
```

See [Pricing & Curves](../concepts/pricing-and-curves) for sign conventions.
