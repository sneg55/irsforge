---
title: Party Selector
---

# Party Selector (`/`)

**Demo-only.** Hidden when `auth.provider: oidc`.

![Party selector](/img/ui/demo/demo--party-selector.png)

A landing page that lists every entry in `orgs[]` and lets you click into the app **as that party**. Clicking mints a fresh demo JWT in the browser with `daml.unsafeJwtSecret` and stores it in the auth context. The auth service is skipped in demo mode.

| Click | Effect |
|---|---|
| **Goldman** (PartyA) | Active party = PartyA, JWT issued |
| **JPMorgan** (PartyB) | Active party = PartyB, JWT issued |
| **Operator** | Active party = Operator (admin/dispute-resolution view) |
| **Regulator** | Active party = Regulator (read-only) |

Source: `app/src/features/party-selector/`.

## Why not just one user?

The demo's whole point is to let a single browser walk through the same trade from **multiple sides** — propose as A, accept as B, dispute as A, resolve as Operator. The party selector is the cheapest UX for that.

In production this entire surface is replaced by the OIDC login flow; each user receives a ledger JWT scoped to the configured party for their org.
