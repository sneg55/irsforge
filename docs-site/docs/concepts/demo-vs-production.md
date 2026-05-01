---
title: Demo vs Production
---

# Demo vs Production

IRSForge runs in two profiles selected by a single line in `irsforge.yaml`:

```yaml
profile: demo        # or: production
```

The **same code paths** are exercised in both profiles — the demo profile only swaps in stub providers and convenience scaffolding. There is no separate "demo build" of the contracts or oracle.

## What the profile flips

| Concern | `demo` | `production` |
|---|---|---|
| **Auth** | `auth.provider: demo` — browser/oracle mint HS256 demo JWTs, party selector picks the active party, auth service skipped | `auth.provider: oidc` — real OIDC IdP proves identity; IRSForge auth service mints RS256 Canton ledger JWTs |
| **Topology** | `topology: sandbox` — single Canton sandbox, all parties on one participant | `topology: network` — one participant per org, per `orgs[]` entry |
| **Curve providers** | `curves.currencies.*.provider: demo-stub` — pillars come from `demo.stubCurves` | `provider: nyfed` (or other live fetcher in `oracle/src/providers/`) |
| **CDS pricing** | `demo.cdsStub` supplies a flat default-probability and recovery rate | Real credit curve feed (Phase 9) |
| **FX spots** | `demo.fxSpots` seeds `FxSpot` observable contracts at boot | Live FX feed |
| **Curve ticker** | `demo.curveTicker.enabled: true` re-publishes curves with bp-noise so the blotter trend column moves | Off — real curves move on their own |
| **CSA seeding** | `demo.csa.initialFunding` biases the opening signed CSB | Empty / absent — CSAs open flat |
| **Manual buttons** | `scheduler.manualOverridesEnabled: true` exposes "Trigger / Settle Net / Mature" buttons so a human can drive the demo | `false` — buttons hidden, scheduler runs the lifecycle |

## What stays the same

- All Daml templates and choices — the contracts have no `demo` flag.
- The oracle's `mark-publisher`, `scheduler`, `ledger-publisher`, `sofr-service` services run identically.
- The frontend reads the same JSON API and renders the same UI; product visibility is filtered by `observables.*.enabled` regardless of profile.
- The signed CSB margin model, dispute lifecycle, settlement chain, and pricing engine are profile-independent.

## How to switch

1. Edit `irsforge.yaml`:
   ```yaml
   profile: production
   topology: network
   auth:
     provider: oidc
     builtin:
       issuer: "https://auth.example.com"
       keyAlgorithm: RS256
       tokenTtlSeconds: 900
       refreshTtlSeconds: 86400
     oidc:
       authority: "https://login.example.com"
       clientId: irsforge
       clientSecret: "..."
       scopes: [openid, profile, email]
     serviceAccounts:
       - id: scheduler
         actAs: ["Scheduler::..."]
         readAs: ["PartyA::...", "PartyB::...", "Operator::...", "Regulator::..."]
       - id: mark-publisher
         actAs: ["Operator::..."]
         readAs: ["PartyA::...", "PartyB::...", "Regulator::..."]
   curves:
     currencies:
       USD:
         discount:  { provider: nyfed }
         projection: { indexId: USD-SOFR, provider: nyfed }
   scheduler:
     manualOverridesEnabled: false
   # remove the entire `demo:` block
   ```
2. `make build` — `shared-config` regenerates `Setup/GeneratedConfig.daml` from the new yaml.
3. Re-run init against the configured topology.

The schema **rejects** a `demo:` block when `profile: production`, so demo-only knobs cannot accidentally leak into a production config.

## Why one yaml drives both

The hackathon goal is a **reference implementation** — a participant evaluating Canton should be able to read one config file and understand exactly what they need to provide for live deployment. The demo profile exists only to make that file runnable offline; every demo-only key is grouped under the top-level `demo:` block and is opt-in.

See [`reference/config-yaml`](../reference/config-yaml) for the full key-by-key reference.
