---
title: Topology
---

# Topology

`topology:` in `irsforge.yaml` selects the Canton deployment shape.

## `sandbox` (demo default)

```yaml
topology: sandbox
```

- One Canton sandbox process.
- All parties (`PartyA`, `PartyB`, `Operator`, `Regulator`, `Scheduler`) hosted on the same participant.
- One JSON API endpoint at `localhost:7575`.
- Started by `make demo` via `daml start`.

This is the lowest-friction way to see the system end-to-end. The frontend's `/api/ledger` proxy targets the single sandbox; the oracle's `ledger-publisher` writes to it.

## `network` (production)

```yaml
topology: network
```

- One participant node per organisation in `orgs[]`.
- Each org has its own `ledgerUrl` and (typically) its own subdomain.
- The frontend resolves the active participant from the URL (`/org/<orgId>`) and proxies to the correct `ledgerUrl`.
- The oracle and scheduler run as separate participants too — they hold the `Scheduler` and `Operator` parties respectively.

> Only `sandbox` and `network` are valid values for `topology:` — the schema rejects anything else (`shared-config/src/schema.ts`).

## `orgs[]`

```yaml
orgs:
  - id: goldman
    party: PartyA                        # bare hint OK in `sandbox`; full Party::fingerprint in `network`
    displayName: Goldman Sachs
    hint: PartyA
    ledgerUrl: http://localhost:7575     # per-participant in `network`
    subdomain: goldman
```

Every `orgs[]` entry maps a routable identity (`id`, `subdomain`) to a Canton party (`party`, `hint`) on a participant (`ledgerUrl`).

In `sandbox` topology every entry shares the same `ledgerUrl`. In `network` topology each gets its own participant URL.

> **`party` field shape: sandbox vs network.** In `sandbox` topology the demo bootstrap allocates parties by hint, so `party: PartyA` (a bare hint) works. In `network` topology you must use the **full `Party::fingerprint` form** returned by your participant's party allocation step. A bare hint against a real participant triggers `DAML_AUTHORIZATION_ERROR`. See [BYO Topology](../integrators/byo-topology) for the production-shape example.

## Routing

`routing:` controls how the frontend reaches the org-specific UI:

- `routing: path` — `/org/<orgId>` paths (default, works without DNS).
- `routing: subdomain` — `<subdomain>.<host>` virtual hosts (production-style, needs DNS).

`network` topology is the production deployment shape (replacing the earlier `multi` naming).
