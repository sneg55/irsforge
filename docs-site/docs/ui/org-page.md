---
title: Org Page
sidebar_label: Org Page (/org/[orgId])
---

# Org Page (`/org/[orgId]`)

**Purpose:** per-organisation routing + participant scoping.
**Source:** `app/src/app/org/[orgId]/` (routes defined in `app/src/shared/constants/routes.ts`).

![Org page](/img/ui/org/org--landing.png)

In `network` topology each org has its own participant URL. The frontend resolves the active org from the URL segment (`/org/goldman`, `/org/jpmorgan`, …), sends `X-Irsforge-Org: <orgId>` on ledger requests, and the `/api/ledger` proxy forwards to that org's `ledgerUrl`.

`/org/[orgId]` itself has no landing UI. It redirects through `defaultLandingRoute` (`app/src/shared/constants/routes.ts`) using `orgs[].role`:

- `trader` → `/org/<id>/blotter`
- `operator` → `/org/<id>/operator`
- `regulator` → `/org/<id>/oversight`

| Sub-route | Page |
|---|---|
| `/org/<id>` | Redirect to the role-specific landing page |
| `/org/<id>/blotter` | Trader/operator org-scoped blotter |
| `/org/<id>/workspace` | Trader/operator workspace |
| `/org/<id>/csa` | Trader/operator CSA page |
| `/org/<id>/operator` | Operator inbox (operator role only) |
| `/org/<id>/oversight` | Regulator cross-org oversight blotter |
| `/org/<id>/timeline` | Regulator business-event timeline |
| `/org/<id>/csa-board` | Regulator CSA oversight board |
| `/org/<id>/login` | Login (demo party selector / OIDC entry) |
| `/org/<id>/callback` | OIDC callback |

`(auth)` in the source tree is a Next.js **route group** — it does not appear in the URL. The public paths are `/org/<id>/login` and `/org/<id>/callback`.

The shell also blocks wrong-role pages. A regulator who navigates to `/blotter`, `/workspace`, `/csa`, or `/operator` is redirected back to `/oversight`; traders cannot open `/operator` or regulator pages.

In `sandbox` topology every entry routes to the same single sandbox.

## Configurable via yaml

| yaml key | Effect |
|---|---|
| `orgs[]` | Each entry creates an `/org/<id>` route |
| `orgs[].displayName` | Title rendered on the page |
| `orgs[].role` | Drives the default landing route and visible navigation (`trader`, `operator`, `regulator`) |
| `orgs[].ledgerUrl` | Where this org's API calls are proxied (network only) |
| `orgs[].streamUrl` | Optional WebSocket URL for Canton JSON API streams; derived from `ledgerUrl` when omitted |
| `orgs[].subdomain` | Used when `routing: subdomain` |
| `routing: path` | URLs use `/org/<id>` |
| `routing: subdomain` | URLs use `<subdomain>.<host>` |
