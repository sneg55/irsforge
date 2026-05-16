---
title: Demo Curve Ticker
---

# Demo Curve Ticker

`oracle/src/services/demo-curve-ticker.ts` — **demo-only**.

Re-publishes every seeded curve on a cron with a small random perturbation in basis points, so the blotter's "Trend" sparkline column accumulates history during a demo session.

## Why it exists

Canton's `PublishDiscountCurve` archives the previous `Curve` contract on every publish. The ACS holds **exactly one** curve per key. Without something tickling the curves, `useCurveStream` in the frontend would never see more than a single point and the trend column would be flat.

## Config

```yaml
demo:
  curveTicker:
    enabled: true
    cron: "*/30 * * * * *"   # every 30 sec
    bpsRange: 0.25           # ± 0.25 bps perturbation per pillar
```

## What gets ticked

Every entry in `demo.stubCurves.<ccy>.{discount,projections}.*`. Each tick:

1. Reads the seeded pillars from yaml.
2. Adds `Uniform(-bpsRange, +bpsRange) / 10000` to each `zeroRate`.
3. Publishes a fresh `Curve` (which archives the old one) and appends a `CurveSnapshot` (which doesn't).

### Multi-projection rule

For each currency the ticker iterates **every** entry in `stub.projections` — not just the "primary" projection named by `curves.currencies.<ccy>.projection.indexId`. That matters when a currency carries more than one rate index (USD has both `USD-SOFR` and `USD-EFFR`; the latter funds BASIS-swap projection): every seeded index must get a fresh tick or the secondary ones drift past the staleness threshold (default 10 min, see `app/src/features/operator/hooks/use-curve-staleness.ts`) and the blotter's "valuation may be stale" banner pins.

State mirroring (the overnight-rate write into shared `State`) intentionally fires only for the primary `indexId` — `daily-publisher-bootstrap` keys off USD-SOFR overnights and isn't multi-index aware.

## Production behaviour

`enabled: false` (or remove the whole `demo:` block when `profile: production`). Live feeds publish their own curves on their own cadence; the ticker would just add noise.
