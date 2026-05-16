---
title: Regulator
sidebar_label: Regulator
---

# Regulator surfaces

**Purpose:** read-only oversight of every swap and CSA on the platform, plus a streaming audit timeline.
**Who uses it:** regulators (`org.role: regulator` in `irsforge.yaml`).
**Source:** `app/src/features/regulator/`.

Three routes, all gated to the regulator role by `(shell)/layout.tsx`:

| Route | Purpose |
|---|---|
| `/org/[orgId]/oversight` | Cross-org swap blotter — every live, proposed, matured, terminated trade on the platform |
| `/org/[orgId]/timeline` | Append-only stream of business events (trade lifecycle + CSA marks/calls/shortfalls/disputes/settlements) |
| `/org/[orgId]/csa-board` | One card per active CSA across the platform — disputes and margin-call rows float to the top |

A fourth surface, `/org/[orgId]/ledger`, is available to the regulator when `ledgerUi.enabled: true` in the deployed config — same component as the trader's ledger explorer, scoped to whatever the regulator's JWT can read.

## Oversight

Default landing page for the regulator role.

### Columns

| Column | Source |
|---|---|
| Pair | `partyA ↔ partyB` from the workflow (or `proposer → counterparty` for proposed rows) |
| Family | `IRS` / `OIS` / `BASIS` / `XCCY` / `CDS` / `CCY` / `FX` / `ASSET` / `FpML` |
| Notional | Compact `$10M` / `€25M` — same `formatCompactAmount` helper the blotter uses |
| Ccy | Reporting currency from the instrument |
| Status | `Live` / `Proposed` / `Matured` / `Terminated`, colour-coded |
| **Latest MTM** | Pair-level latest mark from on-chain `Csa.Mark:MarkToMarket`, signed from partyA's perspective. Same number across every Live row in the same pair (one mark per pair). `—` for Proposed / Matured / Terminated rows since no live mark exists at those points in a swap's lifecycle. |
| CID | Contract id link to the [Ledger](./ledger) drawer |

Per-trade NPV is intentionally **not** computed on this surface — the regulator would need to replicate the trader's pricing pipeline (curve fetch + instrument resolution + shared-pricing) which is a larger project. The pair-level MTM is enough to spot which pair is running exposure; click through to the [CSA Board](#csa-board) for the per-pair detail.

### Filters

The chip row above the table renders human-labelled status filters — `All`, `Live`, `Proposed`, `Terminal`. (Earlier shape was lowercase + raw enum names; the chips now `capitalize` for read.)

### Counterparty filter

The text input above the chips substring-matches against the resolved display name of either party — typing `JP` narrows to every pair that includes JPMorgan.

## Timeline

Streams every business event (`Csa.*`, `Swap.Workflow:SwapWorkflow`, `Audit.SettlementAudit:SettlementAudit`, etc.) decoded into a readable narrative. Newest first.

### Event row format

```
<Event kind> · <Pair> [, <quantitative payload>]    <relative time>    <cid>
```

The separator between event kind and pair is `·` (middle dot). Em-dash `—` is reserved for the "no data" placeholder elsewhere in the UI — using the same character for both would conflate "separator" with "missing value".

### Event coverage

The filter chips above the stream render human labels. Each chip toggles whether rows of that kind show:

`Trade proposed`, `Trade accepted`, `Matured`, `Terminated`, `CSA published`, `Margin called`, `Dispute opened`, `Dispute escalated`, `Dispute resolved`, `Mark posted`, `Net settled`, `Settlement audited`, `Shortfall`.

`OracleRatePublished` and `CurveSnapshotted` events fall into the system-events bucket — hidden by default; toggle `Include system events` to surface them.

### Quantitative payloads

Where the on-chain event carries a number, the timeline row surfaces it:

| Event | Payload |
|---|---|
| `Trade accepted` | `notional 25.0M` |
| `Mark posted` | `exposure -8,649,123.84` (signed, partyA perspective) |
| `Margin call` | `(USD)` — currency only; the call amount derives from latest mark + thresholds and isn't carried on the CSA state-transition event itself |
| **Shortfall** | `deficit 13,650,000.00 USD` — sourced directly from `Csa.Shortfall:MarginShortfall.{deficit, currency}` so the regulator's headline shortfall event is never blank |
| `Net settled` | `<ccy>: <amount>, <ccy>: <amount>` per ccy bucket |
| `Settlement audited` | `<payer> → <payee> <amount> <ccy>`, prefixed with the source tag (`Swap settle` / `Swap mature` / `CSA netted`) |

## CSA Board

One card per active CSA across the platform. Disputes (`MarkDisputed`, `Escalated`) and margin-call states sort above plain `Active` so the regulator's eye lands on whatever needs attention.

Each card shows the CSA fields that are actually set on chain:

- Threshold `<partyA>` / Threshold `<partyB>` (always present, may be zero)
- MTA
- Valuation ccy
- Governing law (always one of NewYork / English / Japanese)
- Posted by `<partyA>` / Posted by `<partyB>` (per-currency map)
- cid (link to the Ledger drawer)

**ISDA MA** and **Initial Margin** rows are hidden when the corresponding fields are empty / zero rather than rendered as em-dash placeholders. That matches the on-chain reality (the fields exist but aren't required) and stops the card from reading like the schema is half-wired.

## Ledger Activity

When `ledgerUi.enabled: true`, the regulator's `/ledger` page mirrors the trader's surface but scoped to whatever the regulator's JWT can read. The same `LedgerActivityProvider` powers both, and an HTTP-poll seed fills the activity buffer from `/v1/query` in case the WS `/v1/stream/query` ships an empty active set on subscription — a Canton behaviour observed with readAs-only JWTs that's transparent to the user but would otherwise leave the page at `0 events`.

Timestamps render in **UTC** (`HH:MM:SS UTC`) across every ledger row, matching the demo-reset banner — multi-jurisdiction CDN means local-time strings drift between viewers.

## Anti-leak guarantee

Regulator surfaces never expose write-class buttons (`Accept` / `Reject` / `Co-sign` / `Resolve dispute` / `Trigger` / `Settle`). The Daml `observer` clauses on every CSA + swap template grant the regulator visibility but no choice authority; the UI mirrors that with a role check (`useIsRegulator()`) and a Daml-level anti-leak test suite (`regulator/__tests__/anti-leak.test.tsx`) that asserts no such button reaches the rendered tree.

## Configurable via yaml

| yaml key | UI effect |
|---|---|
| `orgs[].role: regulator` | Routes the org's landing to `/oversight`; enables the regulator nav |
| `ledgerUi.enabled` | Adds the `Ledger` tab to the regulator nav when true |
