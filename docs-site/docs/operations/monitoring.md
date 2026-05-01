---
title: Monitoring
---

# Monitoring

What to watch in a production IRSForge deployment.

## Liveness

| Component | Check | Failure mode |
|---|---|---|
| Canton participant(s) | JSON API `/v1/parties` 200 | Ledger reads/writes blocked |
| Oracle | `GET /api/health` on `oracle.url` | No marks, no settlement, no maturation |
| Auth service / OIDC | JWKS reachable, key not rotated | Ledger 401s, frontend logged out |
| Frontend | `/api/config` 200 | UI white-screens on load |

The frontend renders a **scheduler pill** on blotter + CSA pages that reads liveness **from on-ledger events** (latest `MarkToMarket` / netted settlement timestamp via `app/src/shared/scheduler/use-last-tick.ts`), not from an oracle `/health` poll. If the scheduler stops producing ledger events, the pill goes offline — regardless of whether the oracle HTTP server is up.

## Lifecycle progress (the load-bearing thing)

The most important signal: **are scheduler ticks producing on-chain effect/settlement events?**

Watch for:

| Symptom | Likely cause |
|---|---|
| Trigger cron ran but no `Effect` contracts created | Instrument has no due fixings — normal, or `lastEventTimestamp` not grid-aligned |
| `SettleNet` cron ran but CSAs still show outstanding calls | Holdings missing or `Fungible.Split` sized wrong |
| Mature cron ran but matured instruments not archived | `MatureByScheduler` raised, check oracle logs |
| `DAML_AUTHORIZATION_ERROR` from scheduler | Scheduler JWT expired / wrong party / signed wrong |

## Mark publisher health

Per CSA, you want:

- A new `MarkToMarket` contract per `trigger` cron tick (or per configured mark cadence).
- `MarkSnapshot` history accumulating (powers the sparkline).
- Calls computed and acted on within `mta` and `rounding` constraints.

If marks stop publishing, the most common cause is a `CONTRACT_NOT_FOUND` storm — every choice rotates the CSA cid, and the publisher's retry budget is finite. Investigate: is something else exercising the CSA on every tick?

## Auth

- Token TTL — a JWT expiring mid-tick will produce a `DAML_AUTHORIZATION_ERROR`. Refresh tokens before they expire.
- JWKS rotation — Canton caches keys; restart the participant after a key rotation if the new key isn't picked up.

## Curves

- **Live providers** — alert when the upstream feed hasn't published in N minutes (per-provider).
- `Curve` ACS depth — should be exactly **1 per `(ccy, kind)`** (Canton archives on publish). More than 1 is a bug.
- `CurveSnapshot` should grow monotonically.

## Logs

`scripts/demo.sh logs` aggregates everything in development. In production, point each component's stdout at your log aggregator:

| Component | Useful filters |
|---|---|
| Canton participant | `error`, `WARN`, `submission` |
| Oracle | `tick`, `publish`, `settle`, `mature`, `ERROR` |
| Auth | `issued`, `validation_failed` |

## Phase 7+ follow-ups

- The scheduler pill liveness is fragile on cold sandbox boot — improve the readiness check.
- No metrics endpoint yet (Prometheus / OTel) — add when production deployments materialise.
