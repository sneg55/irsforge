---
title: Scheduler
---

# Scheduler

`oracle/src/services/scheduler/` — drives the swap lifecycle on a cron.

## Three crons, one service

| Cron | Default | Choice | What it does |
|---|---|---|---|
| `trigger`   | every 5s  | `TriggerLifecycleByScheduler` + `CreateFixingEventByScheduler` | Walks evolveable instruments, produces `Effect` contracts for due cashflows |
| `settleNet` | every 5s  | `SettleNetByScheduler`        | Aggregates pending effects across the netting set, exchanges margin in one transfer per ccy |
| `mature`    | every 30s | `MatureByScheduler`           | Archives instruments whose final cashflow has settled |

Configure under `scheduler.cron.*`. Crons use 6-field `*/N * * * * *` (with seconds).

## Manual override gating

```yaml
scheduler:
  enabled: true
  manualOverridesEnabled: true     # demo: human can drive
                                   # production: false ⇒ buttons hidden
```

When `manualOverridesEnabled: false`:

- Workspace and CSA pages **hide** the "Trigger / Settle / Mature" manual buttons.
- The scheduler remains the only path to lifecycle progress.
- Sister non-scheduler choices (`TriggerLifecycle`, `SettleVm`) are still callable on-chain by the operator — gating is UI-only, not contract-level.

## Scheduler authority model

Daml 2.x has **no disjunctive controllers** (`controller a | b` doesn't exist). Two patterns make the scheduler authoritative:

### 1. Dual `LifecycleRule`

The instrument carries two `LifecycleRule` contracts — one signed by `operator`, one by `scheduler`. Either can `Evolve`.

### 2. Sister `*ByScheduler` choices

Every choice the scheduler needs has a parallel sister:

| Operator-signed | Scheduler-signed |
|---|---|
| `TriggerLifecycle`        | `TriggerLifecycleByScheduler` |
| `CreateFixingEvent`       | `CreateFixingEventByScheduler` |
| `SettleVm`                | `SettleVmByScheduler` |
| `PublishMark`             | `PublishMarkByScheduler` |
| `MatureInstrument`        | `MatureByScheduler` |

Both sisters share a module-level body helper, so behaviour is identical — only the controller differs.

This was proven end-to-end in Phase 6 Stage C: the scheduler's JWT alone drives a full lifecycle, zero `DAML_AUTHORIZATION_ERROR`.

## Files

| File | Role |
|---|---|
| `index.ts`             | Service entrypoint, registers crons |
| `tick.ts`              | One tick — fetch ACS, decide what to evolve |
| `effect-discovery.ts`  | Finds `Effect` contracts ready to settle |
| `holdings-resolver.ts` | Maps effects to backing holdings (with `Fungible.Split`) |
| `instrument-events.ts` | Walks instruments for upcoming fixings |
| `instrument-maturity.ts` | Detects matured instruments |
| `setup-discovery.ts`   | Locates `LifecycleRule`, `Csa`, etc. on first tick |
| `trigger-lifecycle.ts` | `TriggerLifecycleByScheduler` invocation |
| `settle-net.ts`        | Netting + `SettleNetByScheduler` |
| `mature.ts`            | `MatureByScheduler` |

## Liveness pill

The frontend shows a "Scheduler ON / OFF" pill on the blotter and CSA pages. Liveness is derived **on-ledger** from the scheduler's own activity — the timestamp of the latest `MarkToMarket` / netted settlement event (`app/src/shared/scheduler/use-last-tick.ts`, `scheduler-status-pill.tsx`). No oracle `/health` HTTP poll is involved; if the scheduler stops producing on-chain events, the pill goes offline.

On a fresh sandbox the pill can read offline for the first few ticks before the scheduler has produced its first event — known fragility, Phase 7+ follow-up.
