---
title: Registering a Provider
---

# Registering an Oracle Provider

Adding a new oracle provider — a real-world rate / curve source like RedStone, Chainlink, or your firm's internal feed — is three steps:

1. **Implement the Daml `Provider` interface** on a new template in `contracts/src/Oracle/`.
2. **Write a TS adapter** that implements `OracleProvider`, then **register it** from `oracle/src/providers/bootstrap-registrations.ts`. Both parts live in step 2 below.
3. **Add one entry** to `oracle/src/providers/concrete-template-ids.ts` mapping the provider id to the concrete template id.

That's the entire extension contract. No bootstrap forks, no schema edits, no per-provider literal switches.

The examples below use `redstone` as the canonical "third-party feed" name; it is **not** a built-in provider in this repo — it is what you would write to plug your own source in.

## 1. Daml interface implementation

Every provider template implements `Oracle.Interface:Provider`. The interface choices (`Provider_PublishRate`, `Provider_PublishDiscountCurve`, `Provider_PublishProjectionCurve`) provide the `Observation` / `Curve` / `CurveSnapshot` creation logic from the view; you only supply the view.

```daml
module Oracle.RedStoneProvider where

import Oracle.Interface
import Oracle.Types

template RedStoneOracleProvider
  with
    operator : Party
    subscribers : [Party]
    regulator : Party
    supportedRateIds : [Text]
  where
    signatory operator
    observer subscribers, regulator

    interface instance Provider for RedStoneOracleProvider where
      view = OracleView with
        id = "redstone"
        publisher = operator
        subscribers = subscribers
        regulator = regulator
        supportedRateIds = supportedRateIds
```

`daml build` regenerates the DAR; `make gen-package-ids` regenerates the per-package TS constants.

## 2. TS adapter registration

Step 2 has two parts: writing the `OracleProvider` implementation, and wiring it into the boot-time registration site. Both files always change together when you add a provider.

### Part A — `OracleProvider` implementation

Two patterns work — pick whichever is closer to your provider's shape:

**Builder function** (matches `oracle/src/providers/demo-stub.ts`):

```ts
// oracle/src/providers/redstone.ts
import type { Config } from 'irsforge-shared-config'
import { IRSFORGE_PROVIDER_INTERFACE_ID } from '../shared/generated/package-ids.js'
import type { State } from '../shared/state.js'
import type { OracleProvider, RateObservation } from './types.js'

export function buildRedStoneProvider(config: Config, state: State): OracleProvider {
  return {
    id: 'redstone',
    supportedRateIds: ['USD-SOFR', 'EUR-ESTR' /* … */],
    onchainInterfaceTemplateId: IRSFORGE_PROVIDER_INTERFACE_ID,
    async fetchRate(rateId, date): Promise<RateObservation> {
      const value = await fetchFromRedStone(rateId, date)
      state.recordObservation(rateId, date, value)
      return { rateId, effectiveDate: date, value }
    },
    rateSource: (indexId, date) => /* return number for the daily back-fill */ 0,
  }
}

declare function fetchFromRedStone(rateId: string, date: string): Promise<number>
```

**Class** (matches `oracle/src/providers/cds-stub.ts`):

```ts
import { IRSFORGE_PROVIDER_INTERFACE_ID } from '../shared/generated/package-ids.js'
import type { OracleProvider, RateObservation } from './types.js'

export class RedStoneProvider implements OracleProvider {
  readonly id = 'redstone'
  readonly supportedRateIds = ['USD-SOFR' /* … */]
  readonly onchainInterfaceTemplateId = IRSFORGE_PROVIDER_INTERFACE_ID

  async fetchRate(rateId: string, date: string): Promise<RateObservation> {
    const value = await this.fetchInternal(rateId, date)
    return { rateId, effectiveDate: date, value }
  }

  private async fetchInternal(_rateId: string, _date: string): Promise<number> {
    // … HTTP call, validation, transform …
    return 0
  }
}
```

The full interface (optional `fetchRate`, optional `rateSource`, optional `onPublishedDaily`) is defined in `oracle/src/providers/types.ts`.

### Part B — register at boot

Adapter on its own is dead code; `oracle/src/providers/registry.ts` only sees what `bootstrap-registrations.ts:registerAllProviders` adds. Mirror the existing built-ins, gating on whatever profile / observable flag is appropriate — `buildNyFedProvider` is gated on `observables.IRS.enabled`, and the demo stub on `config.profile === 'demo'`:

```ts
// oracle/src/providers/bootstrap-registrations.ts
import { buildRedStoneProvider } from './redstone.js'
// …

export function registerAllProviders(deps: RegisterAllProvidersDeps): void {
  const { config, state } = deps
  // … existing registrations …

  if (config.curves) {
    registerProvider(buildRedStoneProvider(config, state))
  }
}
```

## 3. Concrete template id

`oracle/src/providers/concrete-template-ids.ts` is the single switch keyed on provider id. Add one line:

```ts
import {
  DEMO_STUB_PROVIDER_TEMPLATE_ID,
  NYFED_PROVIDER_TEMPLATE_ID,
  REDSTONE_PROVIDER_TEMPLATE_ID,
} from '../shared/template-ids.js'

const concreteIds: Record<string, string> = {
  nyfed: NYFED_PROVIDER_TEMPLATE_ID,
  'demo-stub': DEMO_STUB_PROVIDER_TEMPLATE_ID,
  redstone: REDSTONE_PROVIDER_TEMPLATE_ID,
}
```

Add `REDSTONE_PROVIDER_TEMPLATE_ID` to `oracle/src/shared/template-ids.ts` next to the existing `NYFED_PROVIDER_TEMPLATE_ID` / `DEMO_STUB_PROVIDER_TEMPLATE_ID` constants:

```ts
export const REDSTONE_PROVIDER_TEMPLATE_ID =
  `${IRSFORGE_PACKAGE_ID}:Oracle.RedStoneProvider:RedStoneOracleProvider`
```

## 4. Reference it in YAML

```yaml
curves:
  currencies:
    USD:
      dayCount: Act360
      discount:   { provider: redstone }
      projection: { indexId: USD-SOFR, provider: redstone }
```

The provider id is a free-form lowercase string in `shared-config/src/schema.ts` (`/^[a-z][a-z0-9-]*$/`) and is resolved against the runtime registry. If you reference an unregistered id, oracle startup fails fast:

```
oracle.config.invalid: provider 'redstone' referenced in curves.currencies.USD.discount is not registered. Register an OracleProvider in oracle/src/index.ts or set provider to one of: demo-stub, nyfed.
```

## What's outside the interface

The interface is intentionally minimal — three choices that cover the universal write paths every provider needs: a single rate (`Provider_PublishRate`) and the discount + projection curves (`Provider_PublishDiscountCurve`, `Provider_PublishProjectionCurve`). Anything beyond that is **not pluggable through the interface**, and that's deliberate: bulk and back-fill shapes vary per source, so they live as concrete choices on the implementing template instead.

The NYFed provider is the canonical example. `Oracle.NYFedProvider` adds three template-local choices on top of the interface:

- `PublishCurve` — atomic publish of the full SOFR tenor strip (one transaction, one curve as-of).
- `PublishHistory` — back-fill an arbitrary list of historical observations.
- `PublishCurveAndObservations` — atomic curve + per-pillar observations in one transaction so readers never see a partial curve.

Callers that need these write paths talk to the concrete template id and the concrete choice name directly — see `oracle/src/services/ledger-publisher.ts:publishCurve` for the working pattern. The `Provider` interface is *not* in that codepath.

If your provider needs a similar bulk / atomic / history path, do exactly what NYFed does: add concrete choices to your provider template and a small caller that exercises them. The interface stays unchanged, and the registry/dispatch story for `PublishRate` / `PublishDiscountCurve` / `PublishProjectionCurve` keeps working.

## What you don't have to do

- No edits to `oracle/src/providers/daily-publisher-bootstrap.ts` — the daily back-fill picks up your provider via the registry.
- No edits to seed code — `seedCurves` dispatches via the registry.
- No edits to `oracle/src/providers/onchain-publisher.ts` / `ledger-publisher` — they talk to the `Provider` interface, not your concrete template.
- No new schema enum value in `shared-config/src/schema.ts` — provider ids are runtime-validated against the registered set.

## See also

- [`reference/config-yaml`](../reference/config-yaml#curves) — full YAML reference for `curves.currencies.*.{discount,projection}.provider`
- [Providers](../oracle/providers) — provider concept overview and the built-in catalogue
- [Demo vs Production](./demo-vs-production) — how providers differ across profiles
