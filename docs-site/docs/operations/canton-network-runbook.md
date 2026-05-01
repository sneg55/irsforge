---
title: Canton Network Runbook
sidebar_position: 4
---

# Canton Network runbook

The Canton-network-side work for a real testnet or mainnet deployment, separate from the IRSForge application config covered in [Deploying to Production](./deploying-production).

This page is a **roadmap-level checklist**, not a step-by-step participant tutorial. It exists to be honest about what an integrator owns on the Canton side once the IRSForge YAML is configured. Each item is integrator scope; the IRSForge codebase does not pretend to automate participant operations.

## Status

Pre-production. No live testnet or mainnet IRSForge deployments today. The application-side checklist in [Deploying to Production](./deploying-production) is exercised end-to-end on the local Canton sandbox; the items below are what an integrator completes when wiring the same application against real participant infrastructure.

## What you own on the Canton side

### 1. Participant nodes

One participant node per org in `orgs[]`. Each participant runs:

- The Canton participant process.
- The Canton JSON API exposed at the URL configured in `orgs[].ledgerUrl`.
- TLS termination and any reverse-proxy / load-balancer in front.

The IRSForge frontend's `/api/ledger` proxy targets the participant URL. The oracle and auth service are off-participant and talk to the JSON API the same way.

### 2. Synchronizer / domain connection

Each participant connects to the Canton synchronizer (testnet or mainnet) and joins the domain(s) the IRSForge workflows are vetted on. Canton Network topology permissions (DSO authorizations, vetting decisions) are integrator scope.

### 3. DAR upload and package vetting

The IRSForge DAR (`contracts/.daml/dist/irsforge-*.dar`) must be uploaded **and vetted** on every participant that hosts an IRSForge workflow contract. That includes counterparty participants, operator participant, regulator participant, and the scheduler/oracle participant.

After every DAR rebuild, regenerate `template-ids.ts` (`make gen-package-ids`); the file is gitignored and cycles on every build.

### 4. Party allocation

Each `orgs[].party` must be a real, allocated party on its host participant. The IRSForge YAML expects the **full `Party::fingerprint`** form, not a bare hint. Bare hints against a real participant trigger `DAML_AUTHORIZATION_ERROR`.

If your operator owns the `Operator`, `Scheduler`, and `Regulator` parties, allocate them on the operator's participant and put the full IDs into the YAML. Trader parties are allocated on each trader's own participant.

### 5. Participant JWKS wiring

Each participant validates IRSForge-minted ledger JWTs against the IRSForge auth service's JWKS:

```
--auth=rs-256-jwks=<authPublicUrl>/.well-known/jwks.json
```

`<authPublicUrl>` is `platform.authPublicUrl` from `irsforge.yaml`. The auth service must be reachable from each participant; if you use a private network, ensure the JWKS endpoint is exposed on that network.

JWKS rotation: Canton caches keys. After a key rotation, restart participants if they have not picked up the new key. See [Security & Trust — recovery posture](../security-and-trust#recovery-posture).

### 6. Bootstrap and init sequencing

The IRSForge bootstrap (`Setup.RoleSetup`, factories, currencies, holiday calendars, oracle providers, CSAs) currently runs against a single sandbox via `submitMulti`. For multi-participant network bring-up:

- Bootstrap must be sequenced so each `submitMulti` is run from a participant that hosts all required signatories.
- The operator's participant typically runs most of the init since the operator is signatory on factories, reference data, and CSAs.
- Trader-side initialisation (proposing initial trades, accepting proposals) runs from the relevant trader participant.

Production-grade init scripting against a multi-participant topology is not yet packaged. Today it's a manual sequence; integrators have replaced the bootstrap script with their own per-participant orchestration.

### 7. Acceptance / validation

Before treating the integration as live, run a minimum acceptance suite against the real topology:

- [ ] Each org's frontend renders against its own participant URL.
- [ ] OIDC login mints a ledger JWT each participant accepts.
- [ ] A trader can `Propose` a swap and the counterparty observes the proposal.
- [ ] Counterparty `Accept` produces a `SwapWorkflow` visible to both traders + regulator(s).
- [ ] The oracle publishes an `Observation` and `Curve` visible to subscribers.
- [ ] The scheduler drives a full `Trigger → Settle → Mature` cycle without manual intervention.
- [ ] A CSA mark publishes, a margin call is computed, the pledgor `PostCollateral`, the call clears.
- [ ] A `Dispute` transitions a CSA to `MarkDisputed`; operator `AcknowledgeDispute` returns it to `Active`.
- [ ] FpML import, propose, accept, archive round-trips against a real swap.
- [ ] Regulator UI sees every relevant contract from every org.

Each item maps to a specific Daml choice and a specific UI surface. Regression should treat any item flipping back to red as a release blocker.

## What IRSForge owns

The application side, fully covered in [Deploying to Production](./deploying-production):

- `irsforge.yaml` schema and config validation.
- Auth service issuing RS256 JWKS-backed ledger JWTs.
- Service-account credential issuance for the oracle.
- Curve, mark, lifecycle automation via the scheduler.
- Per-family proposal / accept / settle / mature templates.
- CSA model, dispute lifecycle, regulator observation.
- FpML round-trip.
- All UI surfaces.

## What's missing in this runbook

Honest list of what would make this a complete operational runbook (not blocking adoption, but worth knowing):

- A reference participant config (Helm chart / Terraform module) is not packaged.
- A reference DAR-vetting pipeline is not packaged.
- A reference multi-participant bootstrap script is not packaged.
- Production-grade alerting (Prometheus / OTel) is not packaged; on-ledger pill liveness only.

These are integrator scope, by design. IRSForge is a reference application, not a Canton-network distribution. Each item is addressable once a participant operator has standard infrastructure they want to fit IRSForge into.

## See also

- [Deploying to Production](./deploying-production) — application-side checklist
- [BYO Topology](../integrators/byo-topology) — multi-participant YAML shape
- [Service Accounts](./service-accounts) — oracle credentials in the network topology
- [Monitoring](./monitoring) — what to watch in production
- [Security & Trust](../security-and-trust) — credential and trust boundaries
