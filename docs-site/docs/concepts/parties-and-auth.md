---
title: Parties & Auth
---

# Parties & Auth

## Parties

Every IRSForge deployment has five logical parties:

| Party | Role |
|---|---|
| `PartyA` | Counterparty (e.g. Goldman) |
| `PartyB` | Counterparty (e.g. JPMorgan) |
| `Operator` | Platform operator — proposal co-signatory, dispute resolver, scheduler-fallback, reference-data authority. Structurally **cannot** be `partyA`/`partyB` on a swap or CSA. Full breakdown in [Operator Role](./operator-role) |
| `Regulator` | Read-only observer on every swap and CSA contract |
| `Scheduler` | Automated lifecycle driver (oracle-side) |

In `sandbox` topology these are five parties on one participant. In `network` they're hosted across participants per `orgs[]`.

## Auth modes

Selected by `auth.provider`. The schema accepts `demo | builtin | oidc` (`shared-config/src/schema.ts`); the login page (`app/src/app/org/[orgId]/(auth)/login/page.tsx`) branches on that value.

### `demo` — client-minted tokens (no auth service)

```yaml
auth:
  provider: demo
  builtin:
    issuer: "http://localhost:3002"
    keyAlgorithm: RS256
    tokenTtlSeconds: 900
    refreshTtlSeconds: 86400
```

- The `auth/` service exits on startup when `provider: demo` (`auth/src/index.ts`).
- JWTs are **minted in the browser** with the demo HS256 secret from `daml.unsafeJwtSecret` (`app/src/shared/contexts/auth-context.tsx`, `app/src/shared/ledger/parties.ts`). This path is only for the local Canton sandbox; non-demo deployments use the auth service and RS256 JWKS.
- The org `/org/<id>/login` page acts as a **party selector** — clicking "Sign in as PartyA" mints a fresh demo JWT for that party and stores it locally.
- All `/api/ledger` calls from the frontend carry the active party's JWT.

### `builtin` — the auth service mints tokens

```yaml
auth:
  provider: builtin
  builtin: { issuer: "http://localhost:3002", ... }
```

- The `auth/` service runs at `localhost:3002` and handles `/auth/login`, `/auth/refresh`, `/auth/logout`, `/.well-known/jwks.json`. See [API Endpoints](../reference/api-endpoints) for the full list.
- Useful for local multi-participant testing without a real IdP: the browser POSTs party credentials to the auth service, which signs and returns a JWT.

### `oidc` — real IdP

```yaml
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
```

- The party selector is hidden.
- Users log in via the configured IdP. The IdP proves user identity to the IRSForge auth service.
- The current auth service maps the requested `/org/<orgId>` to that entry's configured `orgs[].party`, then mints the Canton ledger JWT with `auth.builtin.issuer`.
- Each Canton participant validates those IRSForge-minted ledger JWTs against the IRSForge auth service JWKS, not against the IdP's raw JWTs.
- Production assumption: each user is a single party (their org's), and the JWT identifies them — no party-switching UI. Before exposing a shared multi-org auth service, add or enable an IdP claim/group check so users can only request their own org.

## JWT flow

```
Browser → IRSForge auth service → external IdP
Browser ← IRSForge ledger JWT
Browser → /api/ledger/* (Next.js proxy)
   ↓ forwards Authorization: Bearer <ledger-jwt>
Canton JSON API (localhost:7575 in sandbox; per-participant in network)
```

The frontend never talks to Canton directly — Canton has no CORS, so all browser requests proxy through `/api/ledger`. See [API Endpoints](../reference/api-endpoints).

## `useLedger().activeParty`

In the frontend, `useLedger().activeParty` mirrors the authenticated session's `party`. In demo mode this is usually the party hint (for example `"PartyA"`); in builtin/OIDC modes it is the configured `orgs[].party`, which should be the full Canton party identifier. For Daml choice arguments that take a `Party`, prefer the full ID from config or the contract payload — passing a bare hint to a production participant triggers `DAML_AUTHORIZATION_ERROR`.
