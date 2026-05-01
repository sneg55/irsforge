---
title: BYO Topology
sidebar_label: BYO Topology
sidebar_position: 4
---

# Bring Your Own Topology

The single-sandbox demo and a multi-participant Canton network share the **same DAR**, the **same UI**, and the **same YAML schema**. What changes is who hosts which party and which JSON API the frontend talks to.

## YAML

```yaml
topology: network

orgs:
  - id: goldman
    party: "GoldmanParty::1220abc..."
    displayName: Goldman Sachs
    hint: GoldmanParty
    ledgerUrl: https://canton.goldman.example
    subdomain: goldman
    role: trader
  - id: jpm
    party: "JPMParty::1220def..."
    displayName: JPMorgan
    hint: JPMParty
    ledgerUrl: https://canton.jpm.example
    subdomain: jpm
    role: trader
  - id: ops
    party: "OperatorParty::1220ghi..."
    displayName: Platform Operator
    hint: OperatorParty
    ledgerUrl: https://canton.operator.example
    role: operator
  - id: reg
    party: "RegulatorParty::1220jkl..."
    displayName: Regulator
    hint: RegulatorParty
    ledgerUrl: https://canton.regulator.example
    role: regulator

routing: subdomain   # or `path` if you don't want per-org DNS
```

Schema constraints (enforced by `shared-config/src/schema.ts`):

- ≥ 1 `operator` org.
- ≥ 1 `regulator` org (multi-jurisdiction allowed since Apr 2026).
- ≥ 2 `trader` orgs.
- Every `party` must be the full `Party::fingerprint` form when running against a real participant — bare hints trigger `DAML_AUTHORIZATION_ERROR`.

## What changes in the stack

| Layer | Change |
|---|---|
| Daml | Nothing — same DAR, same templates. Multi-regulator hardening shipped in v2 of the regulator role; CSA / SettlementAudit projections work across multiple regulators. |
| Oracle / Scheduler | Run as their own participant(s). They hold `Scheduler` (and optionally `Operator`) parties. Set `ledgerUrl` accordingly. |
| Frontend | The `/api/ledger` proxy resolves the active org from the URL (`/org/<orgId>` or `<subdomain>.<host>`) and targets that org's `ledgerUrl`. |
| Auth | `auth.provider: oidc` typically, with `auth.builtin` minting per-participant ledger JWTs. Each Canton participant validates against the IRSForge auth service JWKS. |

## What you don't change

- DAR upload: same DAR uploaded to each participant.
- Pricing engine, lifecycle scheduler, regulator UI: untouched.
- YAML keys other than `topology`, `orgs[]`, `routing`, `auth`.

## See also

- [Topology](../concepts/topology) — the full conceptual reference
- [Deploying Production](../operations/deploying-production) — operational walkthrough
- [`reference/config-yaml`](../reference/config-yaml) — every key documented
