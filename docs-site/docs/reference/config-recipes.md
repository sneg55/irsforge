---
title: Config Recipes
---

# Config Recipes

Common edits to `irsforge.yaml` with the minimum-diff change.

## Add a new currency

```yaml
currencies:
  - code: GBP
    label: British Pound
    calendarId: GBP

curves:
  currencies:
    GBP:
      dayCount: Act365F
      discount:   { provider: demo-stub }
      projection: { indexId: GBP-SONIA, provider: demo-stub }

floatingRateIndices:
  GBP-SONIA:
    currency: GBP
    family: SONIA
    compounding: CompoundedInArrears
    lookback: 0
    floor: null

demo:
  stubCurves:
    GBP:
      discount:    { pillars: [ { tenorDays: 1, zeroRate: 0.045 }, ... ] }
      projections: { GBP-SONIA: { pillars: [ ... ] } }
```

Then `make build` (regenerates Daml config) and restart.

## Add a CDS reference name

```yaml
cds:
  referenceNames:
    - TSLA
    - AAPL        # ← new
```

`make build`, restart. Workspace dropdown picks it up.

## Change CSA thresholds

```yaml
csa:
  threshold:
    DirA: 1000000     # was 0
    DirB: 1000000
```

Affects only **new** CSAs created after the change. Existing CSAs keep their on-chain values; you'd need a migration choice for existing pairs (not currently shipped).

## Switch a curve from demo-stub to live feed

```yaml
curves:
  currencies:
    USD:
      discount:   { provider: nyfed }
      projection: { indexId: USD-SOFR, provider: nyfed }
```

Remove the corresponding `demo.stubCurves.USD` entry. The NYFed provider in `oracle/src/providers/nyfed/` will publish on its own cadence.

## Swap auth from demo to OIDC

```yaml
platform:
  authPublicUrl: "https://auth.example.com"
  frontendUrl:   "https://app.example.com"

auth:
  provider: oidc
  builtin:
    issuer:           "https://auth.example.com"
    keyAlgorithm:     RS256
    tokenTtlSeconds:  900
    refreshTtlSeconds: 86400
  oidc:
    authority:    "https://login.example.com"
    clientId:     irsforge
    clientSecret: "..."
    scopes:       [openid, profile, email]
  serviceAccounts:
    - id: scheduler
      actAs: ["Scheduler::..."]
      readAs: ["PartyA::...", "PartyB::...", "Operator::...", "Regulator::..."]
    - id: mark-publisher
      actAs: ["Operator::..."]
      readAs: ["PartyA::...", "PartyB::...", "Regulator::..."]
```

Then:

1. Keep the `auth.builtin` block. OIDC proves the human identity; IRSForge uses `auth.builtin` to mint the Canton ledger JWT.
2. Configure your IdP client and callback URL. The current auth service maps the requested `/org/<orgId>` to `orgs[].party`; add an IdP claim/group check before exposing one auth service across multiple unrelated orgs.
3. Point each Canton participant JSON API at the IRSForge auth service JWKS, for example `--auth=rs-256-jwks=https://auth.example.com/.well-known/jwks.json`.
4. Create `auth/service-accounts.yaml` and pass the matching `SERVICE_CLIENT_SECRET_*` values to the oracle. Use exact Canton party identifiers in `actAs`/`readAs`. See [Service Accounts](../operations/service-accounts).
5. Restart the auth service, oracle, frontend, and participant JSON API.

## Disable a product family

```yaml
observables:
  CDS: { enabled: false }
```

Workspace tab vanishes, oracle skips CDS pricing strategy registration. Existing on-chain CDS contracts still render in the blotter (you can wind them down) but new CDS proposals are blocked.

## Production-ready config (template)

```yaml
profile: production
topology: network
routing: subdomain

platform:
  authPublicUrl: "https://auth.example.com"
  frontendUrl:   "https://app.example.com"
  frontendUrlTemplate: "https://{subdomain}.app.example.com"

auth:
  provider: oidc
  builtin:
    issuer:           "https://auth.example.com"
    keyAlgorithm:     RS256
    tokenTtlSeconds:  900
    refreshTtlSeconds: 86400
  oidc:
    authority:    "https://login.example.com"
    clientId:     irsforge
    clientSecret: "..."
    scopes:       [openid, profile, email]
  serviceAccounts:
    - id: scheduler
      actAs: ["Scheduler::..."]
      readAs: ["PartyA::...", "PartyB::...", "Operator::...", "Regulator::..."]
    - id: mark-publisher
      actAs: ["Operator::..."]
      readAs: ["PartyA::...", "PartyB::...", "Regulator::..."]

orgs:
  - id: goldman
    displayName: Goldman Sachs
    hint: PartyA
    party: "PartyA::..."
    role: trader
    ledgerUrl: "https://goldman-participant.example.com"
    streamUrl: "wss://goldman-participant.example.com"
    subdomain: goldman
  - id: jpmorgan
    displayName: JPMorgan
    hint: PartyB
    party: "PartyB::..."
    role: trader
    ledgerUrl: "https://jpmorgan-participant.example.com"
    subdomain: jpmorgan
  - id: operator
    displayName: Operator
    hint: Operator
    party: "Operator::..."
    role: operator
    ledgerUrl: "https://operator-participant.example.com"
    subdomain: operator
  - id: regulator
    displayName: Regulator
    hint: Regulator
    party: "Regulator::..."
    role: regulator
    ledgerUrl: "https://regulator-participant.example.com"
    subdomain: regulator

scheduler:
  enabled: true
  manualOverridesEnabled: false   # hide manual buttons
  cron:
    trigger:   "0 */1 * * * *"    # every minute
    settleNet: "0 */5 * * * *"    # every 5 min
    mature:    "0 0 */1 * * *"    # every hour

curves:
  currencies:
    USD: { discount: { provider: nyfed }, projection: { indexId: USD-SOFR, provider: nyfed } }

# (no `demo:` block)
```
