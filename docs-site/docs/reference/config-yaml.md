---
title: irsforge.yaml
sidebar_label: irsforge.yaml reference
---

# `irsforge.yaml` reference

The single source of truth for an IRSForge deployment. Validated by Zod schemas in `shared-config/src/schema*.ts`. Codegens `Setup/GeneratedConfig.daml` so contracts and oracle and frontend all see identical values.

## Top-level

| Key | Type | Required | Default | Notes |
|---|---|---|---|---|
| `profile` | `demo` \| `production` | ✅ | — | Schema rejects `demo:` block when `production` |
| `topology` | `sandbox` \| `network` | ✅ | — | See [Topology](../concepts/topology) |
| `routing` | `path` \| `subdomain` | ✅ | — | URL strategy in `network` |

## `parties`

```yaml
parties:
  scheduler:
    partyHint: Scheduler
```

| Key | Notes |
|---|---|
| `parties.scheduler.partyHint` | Party hint for the oracle's scheduler identity |

## `scheduler`

```yaml
scheduler:
  enabled: true
  manualOverridesEnabled: true
  cron:
    trigger:   "*/5 * * * * *"
    settleNet: "*/5 * * * * *"
    mature:    "*/30 * * * * *"
```

| Key | Default | Notes |
|---|---|---|
| `enabled` | `true` | Off ⇒ no automated lifecycle |
| `manualOverridesEnabled` | `true` (demo) | Show manual buttons in UI |
| `cron.trigger` | every 5s | `TriggerLifecycleByScheduler` cadence |
| `cron.settleNet` | every 5s | `SettleNetByScheduler` cadence |
| `cron.mature` | every 30s | `MatureByScheduler` cadence |

## `platform`

```yaml
platform:
  authPublicUrl: http://localhost:3002
  frontendUrl:   http://localhost:3000
  # Required when routing: subdomain
  # frontendUrlTemplate: "https://{subdomain}.app.example.com"
```

| Key | Notes |
|---|---|
| `authPublicUrl` | Where the IRSForge auth service is reachable from the browser (serves `/auth/authorize`, `/auth/handoff`, `/auth/refresh`, `/auth/login`, `/auth/logout`, and `/auth/oauth/token` for service accounts). Surfaced to the SPA as `authBaseUrl` on `/api/config`. |
| `frontendUrl` | Browser-facing frontend origin. Used for OIDC redirects and auth-service CORS. |
| `frontendUrlTemplate` | Required for `routing: subdomain`; must contain `{subdomain}` and is used to build per-org callback and CORS origins. |

> **URL roles, don't confuse them.** `platform.authPublicUrl` is the IRSForge auth service HTTP origin. `auth.builtin.issuer` is a JWT `iss` claim (a name, possibly differing from the HTTP host). `auth.oidc.authority` is the **external** OpenID Provider (Azure AD / Google / Okta). In real OIDC deployments all three are different hosts — the SPA must call `authPublicUrl` for `/auth/*`, never the IdP.
>
> **CORS / cookies.** The auth service sets HttpOnly refresh cookies; calls from the SPA use `credentials: include`. Either colocate the SPA and auth service on the same registrable domain (cookie-compatible) or run the auth service on a cross-origin host with `SameSite=None; Secure` and an explicit CORS allowlist via `platform.frontendUrl` / `frontendUrlTemplate`.

### platform.ledgerUi (onchain-activity surface)

Gates the [Ledger](../ui/ledger) page, the toast stack, and the clickable `Connected to Canton` pill. Omit the block entirely and you get the defaults shown below.

```yaml
platform:
  authPublicUrl: http://localhost:3002
  frontendUrl:   http://localhost:3000
  ledgerUi:
    enabled: true
    bufferSize: 500
    templateFilter:
      allow: []
      deny:
        - Daml.Finance.Holding
        - Daml.Finance.Settlement.Instruction
      systemPrefixes:
        - Daml.Finance.Data.V4.Numeric.Observation
        - Oracle.Curve
        - Oracle.CurveSnapshot
        - Csa.Csa          # mark publisher rotates on every tick
        - Csa.Mark
        - Csa.Shortfall
        - Csa.Netting
    toasts:
      enabled: true
      maxVisible: 3
      dismissAfterMs: 5000
    rawPayload:
      enabled: true
```

| Key | Default | Notes |
|---|---|---|
| `enabled` | `true` | Master kill-switch. `false` ⇒ pill stays a plain span, no toasts, `/ledger` renders empty. |
| `bufferSize` | `500` | In-memory event buffer per browser tab. Oldest events drop off. |
| `templateFilter.allow` | `[]` | Empty ⇒ the default 29-template IRSForge lifecycle allowlist (oracle + CSA + 9 SwapProposal variants + SwapWorkflow + MaturedSwap + 9 AcceptAck). Non-empty ⇒ only these subscribed on `/v1/stream/query`. |
| `templateFilter.deny` | `[Daml.Finance.Holding, Daml.Finance.Settlement.Instruction]` | **Always hidden** from toasts + page. Infrastructural Daml.Finance noise that floods the stream on every lifecycle tick. |
| `templateFilter.systemPrefixes` | entries shown above | "System-generated" chatter — scheduler/oracle/mark-publisher rotations. **Always hidden from toasts.** Hidden from `/ledger` unless the user checks the **Show system** box. `kind === 'exercise'` bypasses this filter because exercise events only come from the browser's own `LedgerClient.exercise` — always user-triggered. |
| `toasts.enabled` | `true` | Toggle the toast stack independently of the page. |
| `toasts.maxVisible` | `3` | Older toasts slide out as new ones arrive. |
| `toasts.dismissAfterMs` | `5000` | Auto-dismiss timeout. |
| `rawPayload.enabled` | `true` | Show raw Daml JSON in the drawer's `PAYLOAD` disclosure. Demo-appropriate; flip to `false` in production deployments where payloads may leak counterparty-sensitive detail (per-party gating is a deferred follow-up). |

**Prefix matching is package-id-aware.** Canton's wire form is `<64-hex-package-id>:Module.Path:Entity`, so a bare `startsWith('Daml.Finance.Holding')` never matches. The feature's `templateIdMatchesPrefix` helper tries both start-of-string and after-first-colon — set deny/system prefixes as the module-path prefix (e.g. `Oracle.Curve`) without the package hex.

**Cross-ref:** feature overview in [Ledger](../ui/ledger), spec in `docs/superpowers/specs/2026-04-24-onchain-activity-design.md`.

## `auth`

`auth.provider` is one of `demo | builtin | oidc` (`shared-config/src/schema.ts`). See [Parties & Auth](../concepts/parties-and-auth) for when to pick which.

### Demo (client-minted tokens, no auth service)

```yaml
auth:
  provider: demo
  builtin:
    issuer: "http://localhost:3002"
    keyAlgorithm: RS256
    tokenTtlSeconds: 900
    refreshTtlSeconds: 86400
```

> The default demo config includes a `builtin` block for easy profile switching, but the schema only requires it when `auth.provider !== "demo"`. In demo, the `auth/` service exits on startup and JWTs are minted **in the browser** with `daml.unsafeJwtSecret`.

### Built-in issuer (auth service in the loop)

```yaml
auth:
  provider: builtin
  builtin:
    issuer: "http://localhost:3002"
    keyAlgorithm: RS256
    tokenTtlSeconds: 900
    refreshTtlSeconds: 86400
```

The `auth/` service runs and handles `/auth/login`, `/auth/refresh`, `/auth/logout`, etc. Used for local multi-participant testing without a real IdP.

### Production (OIDC)

```yaml
auth:
  provider: oidc
  # Required under oidc: the auth service uses this issuer/key material to
  # mint the Canton ledger JWT after the external IdP verifies identity.
  builtin:
    issuer: "https://auth.example.com"
    keyAlgorithm: RS256
    tokenTtlSeconds: 900
    refreshTtlSeconds: 86400
  oidc:
    authority:    "https://login.example.com"
    clientId:     irsforge
    clientSecret: "…"
    scopes: [openid, profile, email]
  serviceAccounts:
    - id: scheduler
      actAs: ["Scheduler::..."]
      readAs: ["PartyA::...", "PartyB::...", "Operator::...", "Regulator::..."]
    - id: mark-publisher
      actAs: ["Operator::..."]
      readAs: ["PartyA::...", "PartyB::...", "Regulator::..."]
```

OIDC handles human identity. Canton participants should trust the IRSForge auth service JWKS for ledger JWT verification, for example `${platform.authPublicUrl}/.well-known/jwks.json`. Non-demo configs also require `auth.serviceAccounts` entries for `mark-publisher`, and for `scheduler` when `scheduler.enabled: true`; `actAs`/`readAs` must be the exact Canton party identifiers for the target participant topology. Secrets live outside this file in `auth/service-accounts.yaml`.

## `oracle`

```yaml
oracle:
  url: http://localhost:3001
```

## `currencies[]`

```yaml
currencies:
  - code: USD
    label: US Dollar
    calendarId: USD
    isDefault: true
```

| Key | Notes |
|---|---|
| `code` | ISO ccy code (USD / EUR / …) |
| `label` | Display name in UI dropdowns |
| `calendarId` | Holiday calendar id (informational — IRSForge runs 24/7 on-chain) |
| `isDefault` | Initial currency in the workspace composer |

## `cds.referenceNames[]`

```yaml
cds:
  referenceNames:
    - TSLA
```

The CDS workspace dropdown is populated from this list. Add a name here, restart, you can trade it.

## `observables`

```yaml
observables:
  IRS:   { enabled: true }
  OIS:   { enabled: true }
  BASIS: { enabled: true }
  XCCY:  { enabled: true }
  CDS:   { enabled: true }
  CCY:   { enabled: false }
  FX:    { enabled: false }
  ASSET: { enabled: false }
  FpML:  { enabled: false }
```

Per-product enablement. Disabled products vanish from the workspace selector and the oracle skips registering pricing strategies for them.

## `scheduleDefaults`

```yaml
scheduleDefaults:
  IRS:   { frequencyMonths: 3,  dayCountConvention: Act360 }
  OIS:   { frequencyMonths: 12, dayCountConvention: Act360 }
  BASIS: { frequencyMonths: 3,  dayCountConvention: Act360 }
  XCCY:  { frequencyMonths: 6,  dayCountConvention: Act360 }
  CDS:   { frequencyMonths: 3,  dayCountConvention: Act360 }
```

Initial schedule when a user picks a product family in the composer. `rollConvention` is overridden per-trade to match the start-date day-of-month.

## `curves`

```yaml
curves:
  interpolation: LinearZero
  currencies:
    USD:
      dayCount: Act360
      discount:   { provider: demo-stub }     # or: nyfed
      projection: { indexId: USD-SOFR, provider: demo-stub }
```

| Key | Notes |
|---|---|
| `interpolation` | `LinearZero` is the only shipped strategy |
| `currencies.<ccy>.dayCount` | Curve day-count convention |
| `currencies.<ccy>.discount.provider` | A provider id registered in `oracle/src/providers/registry.ts`. Built-ins: `demo-stub`, `nyfed`. See [Registering a Provider](../concepts/registering-a-provider) for adding more. |
| `currencies.<ccy>.projection.indexId` | Floating-rate index id |
| `currencies.<ccy>.projection.provider` | Same contract as `discount.provider` above. |

## `floatingRateIndices`

```yaml
floatingRateIndices:
  USD-SOFR:
    currency: USD
    family: SOFR
    compounding: CompoundedInArrears
    lookback: 2
    floor: 0.0
```

| Key | Notes |
|---|---|
| `family` | `SOFR`, `ESTR`, `LIBOR`, … |
| `compounding` | `CompoundedInArrears`, `OvernightAverage`, `Simple` |
| `lookback` | Days lookback for in-arrears compounding |
| `floor` | Optional rate floor; `null` = none |

## `csa`

```yaml
csa:
  threshold: { DirA: 0, DirB: 0 }
  mta: 100000
  rounding: 10000
  valuationCcy: USD
  eligibleCollateral:
    - { currency: USD, haircut: 1.0 }
    - { currency: EUR, haircut: 1.0 }
```

See [CSA Model](../concepts/csa-model) for semantics.

## `masterAgreements[]`

ISDA Master Agreement registry, keyed by **unordered counterparty pair**. Real banks sign one MA per pair (per jurisdiction) and reference it across every CSA, swap, and trade beneath it — IRSForge models this as YAML so the New CSA proposal modal can pin the reference + governing law as read-only for known pairs instead of asking for free-text every time.

```yaml
masterAgreements:
  - parties: [PartyA, PartyB]
    reference: ISDA-2002-Goldman-JPMorgan-2014-03-12
    governingLaw: NewYork
  - parties: [PartyA, PartyC]
    reference: ISDA-2002-Goldman-Citi-2018-06-01
    governingLaw: English
```

| Field | Type | Notes |
|---|---|---|
| `parties` | `[partyHint, partyHint]` | Unordered — `[A, B]` and `[B, A]` match the same pair. |
| `reference` | string | Free-form identifier. Stored verbatim on chain in `Csa.isdaMasterAgreementRef`. |
| `governingLaw` | `NewYork \| English \| Japanese` | Three values today — extend the schema if the deployment needs more. |

**Pinned vs free-text behavior:** when the active-party + selected-counterparty pair matches a registry entry, the proposal modal renders a read-only "ISDA Master Agreement on file" block and locks the governing law. When it doesn't, the modal falls back to a free-text input + governing-law dropdown so deployments can ship without populating the registry up-front.

**Defaults:** absent or `[]` ⇒ all proposals fall back to free-text. The on-chain `Csa` template stays `Text`/enum regardless — removing a YAML entry doesn't invalidate existing CSAs.

See [BYO Integrator Overview](../integrators/overview) and [CSA Model](../concepts/csa-model#production-metadata-fields).

## `orgs[]`

```yaml
orgs:
  - id: goldman
    party: PartyA
    displayName: Goldman Sachs
    hint: PartyA
    role: trader
    ledgerUrl: http://localhost:7575
    subdomain: goldman
```

One entry per organisation. In `network` topology each `ledgerUrl` is a different participant.

## `demo` (demo profile only)

Schema **forbids** this block when `profile: production`.

```yaml
demo:
  cdsStub:        { defaultProb: 0.02, recovery: 0.40 }
  csa:
    initialFunding: { USD: 5000000 }
  fxSpots:        { EURUSD: 1.08 }
  curveTicker:    { enabled: true, cron: "*/30 * * * * *", bpsRange: 0.25 }
  stubCurves:
    USD:
      discount:    { pillars: [ { tenorDays: 1, zeroRate: 0.053 }, ... ] }
      projections: { USD-SOFR: { pillars: [ ... ] }, USD-EFFR: { pillars: [ ... ] } }
    EUR: { ... }
```

| Block | Purpose |
|---|---|
| `cdsStub` | Flat default-prob + recovery for CDS pricing |
| `csa.initialFunding` | Opening signed CSB at boot |
| `fxSpots` | Seed `Oracle.FxSpot` contracts |
| `curveTicker` | Re-publish curves with bp-noise so the trend column moves |
| `stubCurves` | Pillar values for `provider: demo-stub` curves |

## Validation

`shared-config` runs Zod validation at boot. Errors are reported with full paths (e.g. `csa.eligibleCollateral[1].haircut`).

To regenerate `Setup/GeneratedConfig.daml` after editing yaml:

```bash
make generate-daml-config
```

(This runs automatically as part of `make build` and `make dev`.)
