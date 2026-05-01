---
title: Providers
---

# Providers

A "provider" is a pluggable data source for curves, FX, rates, or credit. Configured per-currency / per-index in `irsforge.yaml`:

```yaml
curves:
  currencies:
    USD:
      discount:   { provider: nyfed }
      projection: { indexId: USD-SOFR, provider: nyfed }
```

## Built-in providers

| Provider | Where | Use |
|---|---|---|
| `demo-stub` | `shared-config` reads `demo.stubCurves` | Demo profile only — offline curves |
| `nyfed`     | `oracle/src/providers/nyfed/`              | Live SOFR + Treasury yields from the NY Fed |

## Adding a provider

See [Registering a Provider](../concepts/registering-a-provider) for the full how-to. The short version is three steps:

1. Implement the Daml `Provider` interface (`Oracle.Interface:Provider`) on a new template under `contracts/src/Oracle/`.
2. Register a TS adapter via `registerProvider` in `oracle/src/providers/bootstrap-registrations.ts`.
3. Add one entry to `oracle/src/providers/concrete-template-ids.ts` mapping the provider id to its concrete template id.

The provider id in `irsforge.yaml` is a free-form lowercase string and is resolved against the runtime registry — no schema enum edits required.

## Provider contract

A TS provider implements `OracleProvider` from `oracle/src/providers/types.ts`:

```typescript
export interface OracleProvider {
  id: string
  supportedRateIds: string[]
  onchainInterfaceTemplateId: string
  fetchRate(rateId: string, date: string): Promise<RateObservation>
  rateSource?: (indexId: string, date: Date) => number
  onPublishedDaily?: (
    indexIds: string[],
    asOf: Date,
    windowDays: number,
    deps: DailyPublishHookDeps,
  ) => void
}
```

The on-ledger publisher exercises the `Provider_PublishRate` / `Provider_PublishDiscountCurve` / `Provider_PublishProjectionCurve` choices on the interface, so the curve / observation / snapshot creation logic lives in `Oracle.Interface` and is shared by every provider template.

## Deferred work

Live providers for EFFR, FX, and credit (CDS reference name default probabilities) are Phase 9. Until then those flows use the corresponding `demo.*` stub blocks.
