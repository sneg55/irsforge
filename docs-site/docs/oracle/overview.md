---
title: Oracle Overview
---

# Oracle Overview

The oracle is a single Node.js process (`oracle/`) hosting multiple cooperating services. It runs as the **`Scheduler`** party and (for some flows) the **`Operator`** party.

## Why off-ledger (and what "on-chain oracle" means on Canton)

Canton has no native price-feed primitive — there is no Chainlink/Pyth equivalent that contracts can read directly. Data has to be brought in by a signer.

Daml templates are deterministic: they cannot issue HTTP calls, poll an exchange, or pull SOFR from a vendor. Any oracle design on Canton therefore reduces to **"which party signs the on-ledger feed contracts, and where does it get its data"**. In IRSForge:

- The **on-ledger surface** (`Observation`, `Curve`, `CurveSnapshot`, scheduler lifecycle choices) **is** the on-chain oracle. It is disclosed, auditable, versioned, and observable by the regulator party.
- The **off-ledger process** in `oracle/` is just the signer's arm — it fetches rates, computes marks, and submits transactions as the `Scheduler` / `Operator` party via the Canton JSON API.

This mirrors how rate markets actually work: participants trust named publishers (ISDA, ICE, Bloomberg, Refinitiv). A named Canton party signing `Observation` contracts is the ledger-native analogue. To adopt IRSForge against a licensed feed, an operator swaps the fetcher implementation — the contract surface does not change.

## Services

| Service | File | Purpose |
|---|---|---|
| **Mark publisher** | `services/mark-publisher/` | Computes per-CSA marks, publishes to ledger |
| **Scheduler** | `services/scheduler/` | Triggers lifecycle, settles netting set, matures instruments |
| **Ledger publisher** | `services/ledger-publisher.ts` | Writes oracle observations to Canton |
| **SOFR service** | `services/sofr-service.ts` | Resolves SOFR feed (live or stub) |
| **Demo curve ticker** | `services/demo-curve-ticker.ts` | Demo-only — perturbs curves so the trend column moves |

## HTTP API

The oracle exposes a small HTTP surface for the frontend (proxied through `/api/oracle/*`):

- Curve fetch / projection
- Pricing inputs (forward rates, discount factors)
- Health / readiness

Default port: **`3001`** (configured via `oracle.url` in `irsforge.yaml`).

## JWT identity

The oracle holds the `Scheduler` party's ledger JWT. In `demo` profile the oracle mints it with the HS256 demo secret. In `builtin` and `oidc` profiles the oracle exchanges the configured `scheduler` service-account secret at IRSForge's `/auth/oauth/token` endpoint; OIDC is only the human login provider.

For mark-publishing calls that need the `Operator`, the oracle obtains an additional `mark-publisher` token the same way.

## Why scheduler is a party

Lifecycle and settlement choices need a Daml signatory. Hardcoding `Operator` would conflate "platform admin" with "automated cron driver". `Scheduler` is a separate party with a separate JWT, allowing operations to revoke its credentials independently and giving regulators a clean view of "what was driven by automation vs. what was a human action".

The dual `LifecycleRule` (operator + scheduler) and **sister `*ByScheduler` choices** were added so the scheduler's authority alone is enough to drive a full lifecycle — see [Scheduler](./scheduler).

## Cron schedule

Configured under `scheduler:` in `irsforge.yaml`:

```yaml
scheduler:
  enabled: true
  manualOverridesEnabled: true   # demo only — exposes manual buttons
  cron:
    trigger:   "*/5 * * * * *"   # every 5 sec
    settleNet: "*/5 * * * * *"
    mature:    "*/30 * * * * *"  # every 30 sec
```

In production lower these to realistic intervals (minutes / hours).
