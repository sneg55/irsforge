---
title: Security & Trust
sidebar_position: 4
---

# Security & Trust

Single page for the CTO / infosec reviewer seat on the buying committee. Trust boundaries, identity stack, secrets handling, and recovery posture in one place.

## Trust boundaries

```
┌──────────────────────┐    OIDC auth code     ┌──────────────────────┐
│   External IdP       │◀─────────────────────▶│  IRSForge auth svc   │
│ (Okta / Azure AD …)  │                        │  RS256 JWKS issuer   │
└──────────────────────┘                        └─────┬────────────────┘
                                                      │ Bearer JWT
              ┌───────────────────────────────────────┼───────────────────┐
              ▼                                       ▼                   ▼
       ┌──────────────┐                     ┌──────────────┐      ┌──────────────┐
       │   Browser    │                     │    Oracle    │      │   Frontend   │
       │   (user)     │                     │  (scheduler  │      │   /api proxy │
       │              │                     │   + mark-pub) │      │              │
       └──────┬───────┘                     └──────┬───────┘      └──────┬───────┘
              │ Bearer JWT (per-org)               │                     │
              │                                    │                     │
              ▼                                    ▼                     ▼
       ┌────────────────────────────────────────────────────────────────────┐
       │           Canton participant(s) — JSON API + ledger                │
       │           validates JWTs against IRSForge auth-svc JWKS            │
       └────────────────────────────────────────────────────────────────────┘
```

Three things to notice:

1. **The browser never talks to the IdP directly**, and never to Canton directly. IdP communication is server-side only (auth code flow). Canton communication is proxied through Next.js `/api/ledger` so the browser is not a CORS / cross-origin endpoint and so token boundaries stay clean.
2. **Canton trusts the IRSForge auth service's JWKS, not the IdP's.** The auth service mints the ledger JWT after the IdP authenticates the user, mapping IdP identity to `orgs[].party`. This is where authorization claims (`actAs`, `readAs`) are stamped.
3. **The oracle obtains its own service tokens via OAuth2 client-credentials** against the same auth service. The user's session token never reaches the oracle.

## Identity stack

| Layer | Component | Algorithm | TTL | Where the secret lives |
|---|---|---|---|---|
| Real user identity | External IdP | (your IdP) | (your IdP) | (your IdP) |
| Ledger JWT | IRSForge auth service | RS256 | 900s default | RS256 private key in auth host |
| JWKS | IRSForge auth service | — | — | Public, served at `/.well-known/jwks.json` |
| Service-account secret | `auth/service-accounts.yaml` | bcrypt(10) | rotated manually | auth host file (gitignored) |
| Service-account access token | OAuth2 client-credentials | RS256 | 900s default | Process memory, refreshed at 80% TTL |
| Demo JWT | Browser-minted (demo profile only) | HS256 | 24h | `daml.unsafeJwtSecret` in repo |

The demo path is for local development only. `auth.provider !== 'demo'` triggers the schema requirement that `auth.builtin` be configured (because Canton speaks RS256 JWKS, not arbitrary IdP tokens).

## Secrets management

### What lives where in production

- **IdP client secret** → secrets manager, injected as env to `auth/`.
- **`auth.builtin` RS256 private key** → auth host filesystem or KMS, with file permissions / KMS policy locking it down to the auth process.
- **Service-account secrets** (`SERVICE_CLIENT_SECRET_*`) → secrets manager, injected as env to the oracle.
- **Bcrypt hashes** → `auth/service-accounts.yaml` on the auth host (gitignored).

### What never lives in source

`auth/service-accounts.yaml`, IdP client secret, RS256 private key, and any `SERVICE_CLIENT_SECRET_*` env are out of source tree. The example file is `auth/service-accounts.example.yaml`; the real one is gitignored.

The repo's `daml.unsafeJwtSecret` is the demo HS256 secret. It is **only** used when `auth.provider === 'demo'` and the auth service exits at startup. In any non-demo profile this secret has no path to mint a token Canton would accept (Canton is configured `--auth=rs-256-jwks=...`, not HS256).

### Rotation

Documented procedure for service accounts ([Service Accounts](./operations/service-accounts)):

1. Generate new secret + bcrypt hash.
2. Update `auth/service-accounts.yaml` on the auth host.
3. Update `SERVICE_CLIENT_SECRET_*` env on the oracle host.
4. Restart auth (picks up new hash).
5. Restart oracle (picks up new secret; acquires fresh JWT).

In-flight tokens remain valid until expiry (default 15 min). No revocation endpoint ships — short TTLs are the design choice. Compromise of a service-account secret is contained to one TTL window after rotation.

For the RS256 private key, rotation requires:

1. Generate a new keypair, add the new public key to the JWKS endpoint (multi-key JWKS).
2. Restart Canton participants if they have cached the old JWKS (Canton caches; participants must re-fetch).
3. Cut over the issuer to mint with the new key.
4. Wait one TTL window, then drop the old key from the JWKS.

## Service-account separation

The two oracle services run as **distinct ledger identities** with distinct credentials:

| Service | `actAs` | What it can do | What it cannot do |
|---|---|---|---|
| `mark-publisher` | `[Operator]` | Publish marks, observations, curves | Drive scheduler-controlled lifecycle |
| `scheduler` | `[Scheduler]` | Trigger lifecycle, settle netting set, mature instruments via `*ByScheduler` choices | Adjudicate disputes, hold positions, publish under operator authority |

Compromise of the scheduler credential cannot adjudicate disputes (different controller). Compromise of the operator credential cannot drive scheduled lifecycle from a clean ledger state without also compromising scheduler — manual operator buttons exist as a fallback only when `scheduler.manualOverridesEnabled: true`, which is a demo-only knob.

This is enforced at the Daml layer, not in middleware. See [Operator Role](./concepts/operator-role) and [Scheduler](./oracle/scheduler) for the structural prohibitions.

## Multi-tenant isolation

The current single-auth-service-per-deployment design assumes:

- Each authenticated user maps to **one** party (their org's).
- The auth service maps the requested `/org/<orgId>` to that org's configured `orgs[].party`.

If you expose a shared auth service across orgs, **add an IdP claim/group check** before minting ledger JWTs so users can only request their own org's party. Without this guard, an authenticated user could request a JWT for another org. The guard is documented as required at [BYO Auth](./integrators/byo-auth#multi-tenant-guard) and [Deploying to Production](./operations/deploying-production) section 2.

Canton sub-transaction privacy then enforces that the JWT can only read what the org's party is observer or signatory on. Cross-org leakage at the ledger layer is impossible by Canton design; the auth-service guard is the additional check at the JWT-issue layer.

## Daml signer model

What each party can authorize on-chain. (Full table in [Operator Role](./concepts/operator-role).)

| Party | Can sign | Cannot sign |
|---|---|---|
| `partyA` / `partyB` | Proposals, accepts, rejects, withdraws, posts, withdraws-excess, disputes, terminate proposals | Anything that requires operator signatory; any scheduler-only choice |
| `Operator` | Factory creates, lifecycle / event factory, reference data, oracle observations, dispute acknowledgements, manual lifecycle fallback | `SwapWorkflow` body (only counterparties sign), bilateral cash holdings |
| `Scheduler` | `*ByScheduler` choices (TriggerLifecycle, SettleNet, Mature, PublishMark, PublishMarkSettleVm, CreateFixingEvent), curve publishes when co-signed | Operator-only choices, trader-only choices |
| `Regulator` | Nothing — observer only | Anything |

Compromise of any single party therefore has a bounded blast radius. The most powerful party in the system is the operator (provisioning + dispute-resolution authority), which is why operator credentials should live behind an HSM or equivalent in any deployment with real economic value at stake.

## Audit logs

| Layer | What's logged | Where |
|---|---|---|
| Ledger | Every contract creation, exercise, archive | Canton participant logs + on-ledger record |
| Auth service | `issued`, `validation_failed`, `service_token_acquired`, `service_token_refreshed`, `service_token_acquire_failed` | Auth service stdout |
| Oracle | `tick`, `publish`, `settle`, `mature`, `ERROR` | Oracle stdout |
| Frontend | Standard Next.js access logs | Next.js host |

Point each component's stdout at your log aggregator. There is no separate IRSForge log database. The on-ledger record is the system of record for trade events; the off-ledger logs cover service health and auth events.

## Recovery posture

| Failure | Containment | Recovery |
|---|---|---|
| Service-account secret leaked | One TTL window (15 min default) | Rotate per [Service Accounts](./operations/service-accounts) |
| RS256 private key leaked | All in-flight ledger JWTs valid until expiry | Multi-key JWKS rotation (above) |
| IdP client secret leaked | Per IdP procedure | Rotate at IdP, redeploy `auth/` env |
| Operator party compromised | Could publish marks, adjudicate disputes, propose-co-sign | Re-key party at participant; revoke old credentials. Migration of existing contracts requires participant-level intervention |
| Scheduler party compromised | Could drive lifecycle in unintended directions | Re-key party at participant; lifecycle effects are visible to regulator |
| Trader party compromised | Could trade as that org | Per IdP procedure; existing trades cannot be retroactively unwound without counterparty consent |

Daml's signatory model means none of the recovery scenarios admit a "rollback the ledger" option. The ledger is append-only; recovery is forward-only with new transactions adjudicating any contested state.

## What we don't ship

- **Prometheus / OTel metrics endpoint**: roadmap; on-ledger pill liveness only today.
- **Automated alerting / paging**: integrator scope.
- **Centralized log database**: stdout-friendly, integrator wires in their aggregator.
- **HSM integration for the RS256 key**: operationally compatible; not packaged in-tree.
- **WAF / rate-limit / DDoS shape**: integrator scope at the network edge.

See [Monitoring](./operations/monitoring) for the in-tree health surfaces.

## See also

- [Service Accounts](./operations/service-accounts) — full setup and rotation procedure
- [Parties & Auth](./concepts/parties-and-auth) — JWT flow in detail
- [BYO Auth](./integrators/byo-auth) — OIDC integration recipe
- [Operator Role](./concepts/operator-role) — structural prohibitions
- [Risk & Controls](./risk-and-controls) — risk-side authority model
- [Compliance & Audit](./compliance-and-audit) — paper trail and regulator visibility
