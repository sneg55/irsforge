---
title: Ledger Activity
sidebar_label: Ledger
---

# Ledger (`/org/[orgId]/ledger`)

**Purpose:** visible proof that activity is settling on-chain — a mini block-explorer scoped to the active party's readable contract set, plus live toasts and a cid deep-link chip everywhere a contract ID is shown.
**Who uses it:** judges watching the demo, operators debugging a workflow, traders confirming an exercise landed.
**MARS analog:** none — this is IRSForge-specific. Closest in TradFi: a Bloomberg TKIT / ATMS message blotter, but for Canton ledger events.
**Source:** `app/src/features/ledger/`.

## Three user-visible surfaces

### 1. Status-bar pill

Bottom-left of every page: `● Connected to Canton ↗ Ledger` becomes a `<Link>` when `platform.ledgerUi.enabled` and the browser has an active ledger client. Click → `/org/<id>/ledger`. When the feature is gated off (or the client is disconnected), the pill falls back to a plain span with the usual `Connected / Disconnected` dot.

### 2. Toast stack

Fixed bottom-left, above the status bar. Color-coded left border: **green = create**, **amber = exercise**, **red = archive**. Each toast is a clickable `<Link>` that opens the ledger page with the drawer pre-focused on the event's contract id.

**Suppression rules** (what you will *not* see as a toast):

- **Unconditional deny** — anything matching `templateFilter.deny` (default: `Daml.Finance.Holding`, `Daml.Finance.Settlement.Instruction`).
- **System chatter** — anything matching `templateFilter.systemPrefixes` (scheduler/oracle/mark-publisher rotations). The `/ledger` page exposes a **Show system** checkbox to opt-in; toasts don't.
- **Initial-ACS replay** — Canton's `/v1/stream/query` replays the full active-contract set on subscribe. The toast stack enforces a 1.5s grace window at mount during which inbound events are marked as seen but do not pop. Buffer still fills, so drawer deep-links work immediately.

**Exercise bypass.** `kind === 'exercise'` bypasses `systemPrefixes` because exercise events only originate from the browser's own `LedgerClient.exercise` calls — always user-triggered in this architecture (the scheduler runs out-of-browser with a separate JWT, so its exercises don't hit the bus). A user `PostCollateral` on a `Csa.Csa` cid still toasts even though `Csa.Csa` is in systemPrefixes.

### 3. Standalone `/ledger` page

Header: `LEDGER ACTIVITY` + count chip + animated `live` dot. Filter bar: `CREATE / EXERCISE / ARCHIVE` toggles, cid-prefix text input, **Show system** checkbox. Body: reverse-chronological table (Kind / Template / Party / Cid / Time). Row click → drawer at right with the full cid, all buffered events for that contract (the lineage — `CREATE → EXERCISE → ARCHIVE`), and an expandable `PAYLOAD` disclosure showing the raw Daml JSON when `rawPayload.enabled: true`.

**URL contract:**

- `/org/<id>/ledger` → list view.
- `/org/<id>/ledger?cid=<full>` → list view with drawer open on that cid. If the cid isn't in the buffer (e.g., a seeded contract from before page mount), drawer shows "No buffered activity for this contract — only events since page load are stored."

### 4. `LedgerCidLink` chip — deep link from any cid

A reusable chip component renders a truncated cid (`0033ec5a…`) as a `<Link>` to `/ledger?cid=<full>`. Already adopted by the workspace on-chain panel — click the cid in a swap's header to jump straight to that workflow's event lineage.

## Data flow (one primitive, many views)

```
Canton /v1/stream/query  ──┐
LedgerClient.exercise ──┐  │    useStreamedEvents (create + archive)
                        │  └─►           +                   ──► useLedgerActivityBuffer
                        └──►  ledgerActivityBus (exercise)        (newest-first, capped)
                                                                         │
                                                 LedgerActivityProvider  │
                                                 (shell-layout level)    │
                                                                         ├─► Toast stack
                                                                         └─► /ledger page
```

Both consumers (toasts + page) read from the same provider buffer — no duplicate WebSockets, no drift.

## Three filter categories

| YAML key | Applied where | Semantics |
|---|---|---|
| `templateFilter.allow` | WS subscription | Empty → the default 29-template IRSForge lifecycle allowlist. Non-empty → only these. |
| `templateFilter.deny` | Render (toasts + page) | **Always hides** events whose template prefix matches. |
| `templateFilter.systemPrefixes` | Render (toasts always; page opt-in) | Scheduler/oracle/mark-publisher chatter. Always suppressed from toasts; suppressed from `/ledger` unless **Show system** is checked. `kind === 'exercise'` bypasses. |

Prefix matching is package-id-aware: a YAML prefix like `Oracle.Curve` matches `<64-hex-package-id>:Oracle.Curve:Curve`. See `app/src/features/ledger/utils.ts:templateIdMatchesPrefix`.

## Limits & follow-ups

- **Buffer is per-tab, per-mount.** `bufferSize: 500` by default; oldest events drop off. Opening `/ledger` in a new tab after the interesting events fired shows "No buffered activity" in the drawer for pre-load cids — we don't persist across reloads.
- **Exercises are local-only.** Canton JSON API v1 `/v1/stream/query` exposes creates/archives but not exercises. Only the browser's own `LedgerClient.exercise` calls surface as `EXERCISE` events. A scheduler-initiated exercise appears as an `ARCHIVE` (of the source contract) plus `CREATE` (of the result) pair — no `EXERCISE` row.
- **Raw payload visibility is deployment-global.** `rawPayload.enabled` applies to every viewer uniformly; per-party gating (e.g., regulator-only payloads) is a logged follow-up.
- **See `docs/superpowers/specs/followups.md` §Onchain Activity** for deferred extensions: server-side event store for historical pagination, scheduler-side gRPC tap for global exercise visibility, per-party raw-payload gating, contract lineage tree view, blotter cid-chip adoption.

## Config

See [`platform.ledgerUi` in config-yaml](../reference/config-yaml#platformledgerui-onchain-activity-surface) for every key + default.
