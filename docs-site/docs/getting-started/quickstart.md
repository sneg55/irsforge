---
title: Quickstart
---

# Quickstart

## Prerequisites

- macOS or Linux
- **Java 17** (for the Daml SDK / Canton sandbox)
- **Node.js 20+** (frontend, oracle, auth, shared-config, docs-site)
- **Daml SDK 2.10.0** — installed automatically by `make setup` if absent
- ~4 GB free RAM (Canton sandbox is JVM-based)

## Install

```bash
git clone https://github.com/sneg55/irsforge
cd irsforge
make setup
```

`make setup` installs the Daml SDK, downloads the Daml Finance bundle, generates `Setup/GeneratedConfig.daml` from `irsforge.yaml`, and runs `npm install` in every workspace.

## Run the demo

```bash
make demo
```

The default `irsforge.yaml` ships with `profile: demo` and `auth.provider: demo`, so this starts the **demo profile** — same code paths as production, with stub providers and the SPA party-selector for identity. See [Demo vs Production](../concepts/demo-vs-production) for the full list of what each profile flips.

### What's running in demo profile

| Service | Port | Notes |
|---|---|---|
| Frontend | `:3000` | Next.js — SPA party selector |
| Oracle | `:3001` | Mark publisher, scheduler, curve ticker |
| Canton JSON API | `:7575` | Sandbox topology, no JWKS auth |
| Canton ledger | `:6865` | gRPC |
| Auth service | — | **Skipped** in demo profile (party selector handles identity) |

Then `Setup.DemoSeed:seed` populates parties, instruments, FX spots, stub curves, the CSA, and a couple of seeded swaps.

When you see `IRSForge demo is up.`, open:

**http://localhost:3000**

Pick a party (e.g. Goldman) on the party-selector page, then click around — workspace, blotter, CSA.

### Running a local production-like auth profile

To exercise the same stack with a real OIDC IdP and JWKS-gated JSON API:

1. Edit `irsforge.yaml` — set `profile: production`, `auth.provider: oidc`, add the required `auth.builtin` and `auth.serviceAccounts` blocks, switch curve providers off `demo-stub`, and remove the `demo:` block. See [`reference/config-yaml`](../reference/config-yaml) for every key.
2. Re-run `make demo` (or `./scripts/demo.sh start`).

This is still a local sandbox run: `make demo` starts the local Canton sandbox and JSON API. In this profile the **auth service runs on `:3002`**, verifies users through your IdP, mints IRSForge ledger JWTs, and starts Canton's local JSON API with `--auth=rs-256-jwks=http://localhost:3002/.well-known/jwks.json`. The frontend uses real per-org login instead of the party selector.

For Canton testnet/mainnet, do not use `make demo` as the deployment control plane. Configure `topology: network`, point each `orgs[].ledgerUrl` at the real participant JSON API, upload the DAR and initialize contracts on those participants, and follow [Deploying to Production](../operations/deploying-production).

| Service | Demo profile | Local production-like profile |
|---|---|---|
| Auth service `:3002` | skipped | running, JWKS-backed |
| Canton JSON API auth | none | `--auth=rs-256-jwks` |
| Identity | SPA party selector | OIDC IdP |
| Curve providers | `demo-stub` | live (e.g. `nyfed`) |

## Stop

```bash
make stop          # or: ./scripts/demo.sh stop
make status        # show per-service health
make restart       # stop + start
make logs SVC=canton   # tail one service
```

`make demo` returns control once everything is up, so there is no foreground process to Ctrl-C. See [CLI & Make targets](../reference/cli-and-make).

## Test

```bash
make test         # Daml contract tests
make test-auth    # auth + shared-config unit tests
make test-pricing # pricing engine
```

## Docs locally

```bash
make docs
```

Live preview at http://localhost:3030.
