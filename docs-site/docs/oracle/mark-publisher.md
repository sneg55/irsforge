---
title: Mark Publisher
---

# Mark Publisher

`oracle/src/services/mark-publisher/` — runs every scheduler tick, publishes one mark per CSA.

## What it computes

For each `Csa` contract:

1. **Discover the netting set** — all open swap instruments between `partyA` and `partyB` (`netting-set.ts`).
2. **Price each leg** — call the pricing engine (`shared-pricing/`) with current curves + FX spots.
3. **Aggregate to `valuationCcy`** — translate per-leg NPVs through `FxSpot` to the CSA's reporting currency (`compute.ts`).
4. **Compute the call** — `targetCsb - currentCsb`, gated by `mta` and snapped to `rounding`.
5. **Publish** — `PublishMarkByScheduler` on the `Csa`, creating a `MarkToMarket` contract and (if a call is due) flipping the CSA to `MarginCallOutstanding`.

## Files

| File | Role |
|---|---|
| `compute.ts` | Pricing aggregation + signed CSB call math |
| `formula.ts` | Per-leg pricing strategy dispatch |
| `netting-set.ts` | Discover instruments under a CSA |
| `decode.ts` | Parse Canton JSON API payloads to typed records |
| `publisher.ts` | `PublishMarkByScheduler` exercise + retry on cid rotation |
| `snapshot.ts` | Append `MarkSnapshot` for sparkline history |
| `replay.ts` + `replay-decode-*.ts` | Replay tool — re-price historical marks for debugging |

## Cron

Driven by `scheduler.cron.trigger` (default: every 5 seconds in demo). The same tick that triggers lifecycle also publishes marks.

## Replay

```bash
cd oracle && npm run replay -- --csa <csaCid> --from 2026-04-01
```

Re-fetches every `MarkSnapshot` for the CSA, re-runs `compute.ts` against the curves at each timestamp, and prints diffs against what was actually published. Useful when investigating "why was the call $X on day Y".

## Failure modes

| Symptom | Cause |
|---|---|
| `CONTRACT_NOT_FOUND` on publish | CSA cid rotated mid-tick — publisher retries via `exerciseCsaWithRetry` |
| `DAML_AUTHORIZATION_ERROR` | Scheduler JWT missing or wrong party — check auth service |
| Stale mark | Curves not updating — check curve ticker (demo) or live provider (prod) |
| Wrong sign on call | Pre-2026-04-21 bug; pricing strategies must use `ctx.book` not `ctx.curve` |
