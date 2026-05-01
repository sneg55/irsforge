---
title: BYO Integrator Overview
sidebar_label: Overview
sidebar_position: 1
---

# Bring Your Own

A reference implementation owes you the **shape** and the **seam**, not the data, the auth provider, or the topology. IRSForge is wired so each of those is an additive integration — a YAML edit plus a small adapter — and the rest of the stack stays untouched.

| What you bring | What changes in IRSForge | Recipe |
|---|---|---|
| **Auth provider** (your IdP) | YAML: `auth.provider: oidc` + `auth.oidc.*`. Keep `auth.builtin` for ledger JWTs. | [BYO Auth](./byo-auth) |
| **Oracle / data provider** (rates, FX, credit) | New Daml template implementing `Oracle.Interface.Provider` + TS adapter implementing `OracleProvider` + one line in `bootstrap-registrations.ts` + YAML provider id. | [BYO Oracle](./byo-oracle) |
| **Topology** (multi-participant) | YAML: `topology: network` + per-participant party hosting. Same DAR. | [BYO Topology](./byo-topology) |
| **Currencies, indices, ref-names** | YAML only: `currencies:` / `rateFamilies:` / `cds.referenceNames:`. Run `make generate-daml-config`. | [Config YAML](../reference/config-yaml) |
| **ISDA Master Agreements** (per pair) | YAML only: `masterAgreements:` lists the signed MA per counterparty pair so the CSA proposal modal pins reference + governing law as read-only. Free-text fallback when not registered. | [Config YAML — masterAgreements](../reference/config-yaml#masteragreements) |

## Design principle

Two providers ship in-tree side-by-side: **NY Fed SOFR** (real public source) and a **demo stub** (deterministic, offline). Both go through the exact same `Oracle.Interface.Provider` seam. That side-by-side is the proof that the seam works — and it's the same seam a third-party hazard or FX feed would plug into.

The `auth/` service is similarly pluggable: the demo profile mints HS256 JWTs in the browser; the production profile speaks RS256 JWKS to your OIDC provider. The **wire format** to the Canton ledger is identical — what changes is who minted the token and who validates it.

## What we don't ship

By design, a reference implementation is narrow. The following are **integrator scope**, not in-tree:

- A specific data-vendor adapter (Markit, Bloomberg, ICE, Refinitiv) — license-encumbered.
- ISDA Standard Model parity for CDS pricing (flat-forward hazard, JPMCDS routines).
- Credit-event lifecycle (DC auction outcomes triggering contingent payment).
- KYC / AML / booking-system integration.
- Production-grade monitoring beyond the in-tree health card.

Each of those is shaped to plug into the same seams documented here. None of them require forking IRSForge.
