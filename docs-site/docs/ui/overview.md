---
title: UI Overview
---

# UI Overview

The frontend (`app/`) is a Next.js 16 App Router application (React 19), dark mode default, Bloomberg-styled monospace numerics.

The mental model is **SWPM + MARS, on-chain**. A non-technical user coming from Bloomberg should map every page to a screen they already know — see [SWPM / MARS parity](../concepts/swpm-parity) for the full feature map. Each UI page below calls out its SWPM/MARS analog explicitly.

## Site map

| Route | Page | Audience |
|---|---|---|
| `/` | Redirects to `/org` (`app/src/app/page.tsx`) | — |
| `/org` | [Party Selector](./party-selector) — pick the org you're acting as | Demo |
| `/org/[orgId]` | Redirects to the role-specific landing page (`blotter`, `operator`, or `oversight`) | — |
| `/org/[orgId]/login` | [Org login](./org-page) — per-org auth handshake | All |
| `/org/[orgId]/callback` | OIDC callback landing page | Production |
| `/org/[orgId]/blotter` | [Blotter](./blotter) — positions, exposure, FpML | Trader / risk |
| `/org/[orgId]/workspace` | [Workspace](./workspace) — leg composer + pricing | Trader |
| `/org/[orgId]/csa` | [CSA](./csa) — collateral, marks, disputes | Operations / counterparties |
| `/org/[orgId]/ledger` | [Ledger](./ledger) — onchain event stream + cid deep-links | Judges / ops / anyone proving "it's on-chain" |
| `/org/[orgId]/operator` | [Operator](./operator) — co-sign queue, lifecycle events, scheduler health, manual fixings | Operator only |
| `/org/[orgId]/oversight` | Regulator oversight blotter | Regulator only |
| `/org/[orgId]/timeline` | Regulator business-event timeline | Regulator only |
| `/org/[orgId]/csa-board` | Regulator CSA oversight board | Regulator only |

All public URLs are defined in `app/src/shared/constants/routes.ts`. `(auth)` is a Next.js route group — it's a source-tree marker, not part of the URL.

In `sandbox` topology every `<orgId>` resolves to the same Canton sandbox; in `network` each goes to a different participant URL.

## Conventions

Per `.claude/rules/frontend-style.md`:

- Feature modules are self-contained: page + components + types + constants + validation.
- Shared code only in `shared/` — kept minimal.
- React Query for all ledger data fetching.
- Auth context provides the active ledger JWT; all ledger API calls use it.
- No inline styles — Tailwind classes only.
- shadcn/ui for primitives.
- Monospace font for financial numbers.
- **Green = receive, red = pay** for direction.
