---
title: API Endpoints
---

# API Endpoints

## Frontend proxy routes

The frontend lives in `app/src/app/api/`. All browser → backend traffic goes through these routes (Canton has no CORS).

| Route | Proxies to | Purpose |
|---|---|---|
| `/api/ledger/*` | Canton JSON API at `<org.ledgerUrl>` | All ledger reads/writes; forwards `Authorization: Bearer <jwt>` |
| `/api/oracle/[...path]` | `oracle.url` (default `http://localhost:3001`) | Curve fetch, pricing inputs, health |
| `/api/config` | local `irsforge.yaml` resolution | Bootstrap config for the frontend |

### `/api/ledger`

Mirrors Canton's JSON API. Common shapes:

In `network` topology the browser client sends `X-Irsforge-Org: <orgId>` so the proxy can select the matching `orgs[].ledgerUrl`. Omitting that header is only allowed in `sandbox` topology, where the proxy falls back to `orgs[0].ledgerUrl` for pre-login/bootstrap calls.

| Canton endpoint | Use |
|---|---|
| `POST /v1/query` | Read ACS — `Map k v` returns as `[[k,v],...]`, **not** a Record |
| `POST /v1/exercise` | Run a choice — response is `{result: {exerciseResult, events}, status}` |
| `POST /v1/create` | Create a contract |
| `WS /v1/stream/query` | Live updates |

Daml tuples come back as `{_1, _2}` records in JSON, not arrays — destructure accordingly.

### `/api/oracle/[...path]`

GET-only pass-through to `oracle.url` (`app/src/app/api/oracle/[...path]/route.ts`). The proxy prepends `/api/` to the forwarded path, so browser requests to `/api/oracle/health` hit the oracle's `/api/health`. For the actual route list see **Oracle HTTP API** below.

### `/api/config`

Returns the resolved config the frontend needs (party list, observables, currencies, indices, csa params). Sourced from `shared-config` — never directly from `irsforge.yaml` to avoid leaking server-side paths.

## Oracle HTTP API

Default port `3001` (configurable via `oracle.url`). Routes live in `oracle/src/api/server.ts`.

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Liveness + mode. Proxied to the browser as `/api/oracle/health` |
| `POST /api/publish-curve` | Publish a curve to the ledger (pillars + metadata) |
| `POST /api/publish-rate` | Publish a single floating-rate observation |
| `POST /api/fetch-sofr` | Pull SOFR from the configured provider (NY Fed in demo) |

Pricing, fixings and curve reads happen **on-ledger** — the frontend queries the Canton JSON API directly via `/api/ledger` rather than a dedicated oracle HTTP endpoint. See [Canton oracle model](../oracle/overview).

## Auth service

Default port `3002` (configurable via `auth.builtin.port`; browser-facing origin is `platform.authPublicUrl`). Routes live in `auth/src/index.ts`. Only runs when `auth.provider` is `builtin` or `oidc` — it exits on startup when `provider: demo`.

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /.well-known/jwks.json` | GET | JWKS — Canton sandbox is started with `--auth=rs-256-jwks=<this>` |
| `GET /auth/health` | GET | Liveness + active provider |
| `POST /auth/login` | POST | Exchange party credentials for a JWT (builtin mode) |
| `GET /auth/authorize` | GET | OIDC authorization redirect (oidc mode) |
| `GET /auth/callback` | GET | OIDC callback → stores token + redirects to frontend |
| `POST /auth/handoff` | POST | Bridge token from `/auth/callback` (server) to the SPA |
| `POST /auth/refresh` | POST | Refresh an access token |
| `POST /auth/oauth/token` | POST | OAuth2 client-credentials token endpoint for configured service accounts |
| `POST /auth/logout` | POST | Revoke the active session |

There is no generic `POST /token` endpoint and no locally-served `/.well-known/openid-configuration`. Human OIDC discovery comes from the upstream IdP; service accounts use IRSForge's explicit `/auth/oauth/token` endpoint.
