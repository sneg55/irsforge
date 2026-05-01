---
title: SOFR Service
---

# SOFR Service

`oracle/src/services/sofr-service.ts` — resolves the SOFR overnight rate (or its compounded index value) for a given date.

## INDEX vs raw rate

SOFR is published two ways:

- **Raw overnight rate** — the rate set on a given day (e.g. `5.30%`).
- **SOFR Index** — a cumulative compounded index value (NY Fed publishes this as the "SOFR Index"). Coupon for `[start, end]` = `Index(end) / Index(start) - 1`.

Daml Finance's `CompoundedIndex Act360` reference-rate type interprets each `Observation` as an **Index value**, not a raw rate. **If you publish raw rates and read them as `CompoundedIndex`, the math is silently wrong** — the floating coupons will be ~5% per *day* instead of per *year*.

For the SOFR family use Index values. For products that need raw daily rates (e.g. simple-average overnight averages), use a different `referenceRateType` and publish raw rates.

## Demo behaviour

In `demo` profile the SOFR service returns synthetic Index values derived from `demo.stubCurves.USD.projections.USD-SOFR`. Stubbed values are deterministic so tests are reproducible.

## Production behaviour

Set `curves.currencies.USD.projection.provider: nyfed`. The NYFed fetcher in `oracle/src/providers/nyfed/` pulls the official daily SOFR Index publication and writes it to the `Curve` template via `ledger-publisher`.
