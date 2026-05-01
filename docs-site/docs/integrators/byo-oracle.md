---
title: BYO Oracle / Data Provider
sidebar_label: BYO Oracle
sidebar_position: 3
---

# Bring Your Own Oracle / Data Provider

Three steps. No fork. The same path the in-tree NY Fed SOFR provider takes.

## Step 1 — Daml provider template

Implement `Oracle.Interface.Provider` in a new template under `contracts/src/Oracle/`. Mirror `NYFedProvider.daml`:

```haskell
template MyVendorProvider
  with
    publisher : Party
    subscribers : [Party]
    regulators : [Party]
  where
    signatory publisher
    observer subscribers, regulators
    interface instance Oracle.Interface.Provider for MyVendorProvider where
      view = OracleView with publisher, subscribers, regulators
```

Add concrete bulk / atomic / history choices on the template if your data shape benefits from them — the NY Fed provider's `PublishCurve` and `PublishCurveAndObservations` are examples. The interface stays minimal (`Provider_PublishRate` / `Provider_PublishDiscountCurve` / `Provider_PublishProjectionCurve`); anything bulk-shaped lives as a concrete choice.

## Step 2 — TS adapter + register

Add an adapter under `oracle/src/providers/`:

```typescript
import { IRSFORGE_PROVIDER_INTERFACE_ID } from '../shared/generated/package-ids.js'
import type { OracleProvider, RateObservation } from './types.js'

export class MyVendorProvider implements OracleProvider {
  readonly id = 'my-vendor'
  readonly supportedRateIds: string[]
  readonly onchainInterfaceTemplateId = IRSFORGE_PROVIDER_INTERFACE_ID

  constructor(readonly config: MyVendorConfig) { /* ... */ }

  async fetchRate(rateId: string, date: string): Promise<RateObservation> {
    const value = await fetchFromVendor(rateId, date)
    return { rateId, effectiveDate: date, value }
  }
}
```

Register from `oracle/src/providers/bootstrap-registrations.ts`:

```typescript
registerProvider('my-vendor', (cfg) => new MyVendorProvider(cfg.providers.myVendor))
```

The provider id is a free-form lowercase string (`/^[a-z][a-z0-9-]*$/`) and is resolved against the runtime registry. Unregistered ids fail at startup with a clear message.

## Step 3 — YAML

Reference the new id from `irsforge.yaml`:

```yaml
curves:
  currencies:
    USD:
      discount: { provider: my-vendor }
      projection: { provider: my-vendor }
```

Or for CDS scalar feeds:

```yaml
cds:
  referenceNames: [TSLA, AAPL]
  provider: my-vendor   # see schema; defaults to demo cds-stub
```

## What the rest of the stack assumes

- Rate ids follow the convention `<INDEX>/<TENOR>` for projections, `<CCY>/<KIND>` for discount, `CDS/<NAME>/<DefaultProb|Recovery>` for credit. See `shared/generated/rate-families.ts`.
- Observations land on-ledger as `Daml.Finance.Data.V4.Numeric.Observation` rows; the pricing engine consumes them via `Observation.observe` (exact-time `Map.lookup` — grid alignment matters).
- Sub-transaction privacy: only parties listed in `subscribers` see the observations.

## What we don't ship

- A specific data-vendor adapter. Licensing varies and is out of scope.
- Bootstrap routines for hazard / forward / FX curves beyond the demo defaults — the strategies live in `shared-pricing/src/engine/strategies/` and are integrator-replaceable.

## See also

- [Registering a Provider](../concepts/registering-a-provider) — the full conceptual reference
- [Oracle Overview](../oracle/overview) — how the on-ledger oracle model works
- [Demo vs Production](../concepts/demo-vs-production) — schema-enforced separation
