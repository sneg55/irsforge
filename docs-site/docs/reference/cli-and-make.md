---
title: CLI & Make targets
---

# CLI & Make targets

## Make targets

| Target | What it does |
|---|---|
| `make setup` | Install Daml SDK, fetch Daml Finance bundle, regenerate Daml config, `npm install` everything |
| `make build` | Full build: shared-config → contracts → app + oracle + auth |
| `make dev` | Start Canton sandbox + auth + oracle + frontend in foreground (no auto-seed) |
| `make demo` | Start the full stack and auto-seed — thin shim over `./scripts/demo.sh start` |
| `make stop` | Stop everything cleanly — `./scripts/demo.sh stop` |
| `make restart` | Stop then start — `./scripts/demo.sh restart` |
| `make status` | Per-service pid / port / health table — `./scripts/demo.sh status` |
| `make logs SVC=<service>` | Tail logs for one service (`canton`, `auth`, `oracle`, `app`) |
| `make test` | Daml contract tests |
| `make test-auth` | shared-config + auth unit tests |
| `make test-pricing` | Pricing engine vitest |
| `make generate-daml-config` | Re-emit `Setup/GeneratedConfig.daml` from yaml |
| `make gen-package-ids` | Regenerate per-DAR package-id constants (run after every DAR rebuild) |
| `make lint-hardcodes` | Fail if Phase-0 hardcodes creep back into source |
| `make docs` | Live preview of this site at http://localhost:3030 |
| `make docs-build` | Static build of this site (CI gate) |
| `make clean` | `make stop` + wipe build artefacts (`.daml/`, `node_modules`, etc.) |

`make demo` / `stop` / `restart` / `status` / `logs` all delegate to `scripts/demo.sh`, the canonical orchestrator. There is intentionally one control plane — downstream Canton participants forking this repo inherit one set of lifecycle commands, not two.

## `scripts/demo.sh`

The canonical orchestrator. The Make targets above are thin shims; you can call `scripts/demo.sh` directly when scripting outside `make`.

| Subcommand | What it does |
|---|---|
| `./scripts/demo.sh start`   | Build prereqs, start Canton + oracle + frontend (+ auth if `auth.provider != demo`), seed demo data, return when ready |
| `./scripts/demo.sh stop`    | Stop everything cleanly (incl. orphan Canton JVMs); wipes the `.demo/seeded` marker |
| `./scripts/demo.sh restart` | `stop` then `start` |
| `./scripts/demo.sh status`  | Per-service pid / port / state / health table |
| `./scripts/demo.sh logs <service>` | Tail logs for one service — `<service>` is required, one of `canton \| auth \| oracle \| app`. No aggregated tail. |

`scripts/lib/daml-env.sh` (sourced by `daml-quiet.sh`, `demo.sh`, and `gen-package-ids.sh`) bootstraps `PATH` and `JAVA_HOME` for non-interactive shells. Override `IRSFORGE_DAML_HOME` or `IRSFORGE_JAVA_HOME` for non-Homebrew installs (Linux apt, Nix, custom layouts).

### Idempotent seeding

`Setup.DemoSeed:seed` is gated by an on-ledger sentinel (`Setup.SeedSentinel.DemoSeedComplete`, keyed on the operator party). On a successful run the seed creates the sentinel as its last action; subsequent runs query by key and short-circuit with `Demo seed already complete — skipping`.

`scripts/demo.sh` additionally maintains a `.demo/seeded` file marker as a fast-path skip. The marker and the sentinel together cover three rerun scenarios:

| Scenario | Behaviour |
|---|---|
| Marker present, sentinel present | Marker fast-path skip (no script invocation) |
| Marker wiped, sentinel present | Sentinel-prelude skip — debug logs `Demo seed already complete` |
| Marker wiped, sentinel absent (partial-failure recovery) | Full reseed — body is non-replayable on a dirty ledger; recover via `make clean && make demo` |

If a partial seed leaves the ledger in a dirty state where no sentinel was created but contract keys collide on retry, the recovery path is `make clean && make demo` (full sandbox reset).

## Useful commands

### Re-seed without restart

```bash
cd contracts
$(make -p | grep '^DAML :=' | awk '{print $3}') script \
  --dar .daml/dist/irsforge-contracts-0.0.1.dar \
  --script-name Setup.DemoSeed:seed \
  --ledger-host localhost --ledger-port 6865
```

### Regen package-ids after a DAR change

```bash
make gen-package-ids
```

The `app/src/shared/ledger/template-ids.ts` file is **gitignored** and must be regenerated after every `daml build`.

### Replay marks (debugging)

```bash
cd oracle && npm run replay -- --csa <csaCid> --from 2026-04-01
```

See [Mark Publisher](../oracle/mark-publisher#replay).

## Screenshot capture

Screenshots for the UI section are captured manually against a running `make demo` via agent-browser. Procedure is documented in `docs-site/scripts/capture-screenshots.md`. Output: `docs-site/static/img/ui/<page>/<page>--<state>.png`.

To add or refresh shots:

1. Start the demo: `make demo`
2. Open agent-browser to each route, capture at viewport 1440×900, dark mode.
3. Save with the naming convention `<page>--<state>.png`.

A scripted version (`capture-screenshots.ts`) is a Phase-2 follow-up — not implemented yet.
