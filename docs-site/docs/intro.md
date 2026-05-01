---
slug: /
title: IRSForge
sidebar_position: 1
---

# IRSForge

On-chain Interest Rate Swap platform for [Canton Network](https://www.canton.network/).

Built for **HackCanton Season #1, Track 1 (RWA & Business Workflows)**, and engineered as a **reference open-source implementation** that real Canton participants can adopt without forking.

Five product families (IRS, OIS, Basis, XCCY, CDS) on the full Daml Finance stack. Signed-CSB margin model. Oracle-driven 24/7 lifecycle. FpML round-tripping. Regulator wired in as observer at contract creation, not as a quarterly export.

## Start here

:::tip[Judges]
**[5-minute click-through →](./judges/quickstart)** Live-demo tour that exercises every load-bearing feature: propose, accept, lifecycle, margin call, post collateral. Screenshots inline.
:::

:::info[Buyers]
**[Live demo at demo.irsforge.com →](https://demo.irsforge.com)** Seeded parties, seeded trades, no install. A live Canton sandbox you can click through right now.

**[Talk to the team →](https://cal.com/sawinyh/irsforge-demo)** · **[Source on GitHub →](https://github.com/sneg55/irsforge)**
:::

## What it is

[Canton Network settles roughly $9T a month on-chain](https://www.canton.network/) across tokenized treasuries, repo, and private credit. None of that book is hedged on-chain today. There is no Bloomberg SWPM equivalent, no MARS, no IRS infrastructure. Hedging means breaking the chain, settling somewhere else, and reconciling two ledgers.

IRSForge closes that gap. The UI is **SWPM-shaped**: same leg composer, same cashflows / risk / scenario tabs, same blotter, same CSA ladder. A non-technical user who already runs SWPM should feel at home in minutes. The on-chain layer is plumbing, not a new paradigm to learn. See [SWPM / MARS parity](./concepts/swpm-parity) for the feature-by-feature map.

Any Canton participant edits one YAML file, plugs in their own OIDC, oracle, and topology, and deploys. The seam is the same one the in-tree NY Fed SOFR provider and demo stub use. Bringing your own data is documented and additive, not a fork. See the [BYO integrator recipes](./integrators/overview).

![IRSForge workspace, leg composer with cashflows, risk and CSA panels](/img/ui/workspace/workspace--irs-composer.png)

## Find your seat

If you're evaluating IRSForge as part of a buying committee, start with the page that matches your role.

### Heads of Trading

If your repo book settles T+0 on Canton and your hedge settles T+2 in a different system, you are running uncovered overnight on every move. IRSForge gives you a SWPM-shaped workspace where the hedge settles on the same ledger as the underlying, weekends included. Same leg composer your desk already runs. Same risk and cashflow views. Different rail.

→ [SWPM / MARS parity](./concepts/swpm-parity) · [Workspace](./ui/workspace) · [Blotter](./ui/blotter)

### Heads of Risk

Counterparty and settlement risk on one ledger. Every CSA pair is a signed contract. Variation margin, threshold, and minimum transfer amount are observable, not implied from statements. The hedge settles where the exposure lives, on the same day, on the same ledger, so cross-system settlement risk against off-chain hedges is eliminated by construction. The regulator is wired in as an observer at contract creation, not as a quarterly report.

→ [Risk & Controls](./risk-and-controls) · [CSA Model](./concepts/csa-model) · [Operator Role](./concepts/operator-role)

### Heads of Operations

One ledger to reconcile, not two. Trade economics, lifecycle events, cashflows, and collateral movements live on the same Canton ledger as the underlying book. End-of-day reconciliation across two infrastructures collapses to one. Confirms are a contract state, not an email thread. Disputes are a typed taxonomy, not a phone call.

→ [Swap Lifecycle](./concepts/swap-lifecycle) · [Operator console](./ui/operator) · [Monitoring](./operations/monitoring)

### CTOs and Engineering Leads

Fork the reference implementation. Configure `irsforge.yaml`, point at your participant, deploy. No fork, no integration project, no committee. Built on Daml Finance interfaces as shipped, not reimplemented. Every extension point is a YAML edit plus a small adapter. License is AGPL v3.0; commercial support is something an integrator can layer on, not something IRSForge bundles ([details in FAQ](./faq#whats-the-license)).

→ [Security & Trust](./security-and-trust) · [BYO integrators](./integrators/overview) · [Daml Finance interfaces consumed](./architecture/daml-finance-interfaces) · [Deploying to production](./operations/deploying-production)

### Compliance

Regulator as observer, by construction. Every swap-related contract names the regulator party as an observer at creation. Read access is a [Canton primitive](https://docs.daml.com/concepts/ledger-model/ledger-privacy.html), not a separate audit pipeline. Counterparties never see across each other's books. The regulator sees everything in their jurisdiction. Sub-transaction privacy is a Canton property, not an IRSForge claim.

→ [Compliance & Audit](./compliance-and-audit) · [FpML import / export](./ui/fpml-import-export) · [Operator Role](./concepts/operator-role)

## How it fits together

```
                            ┌──────────────────────────────┐
                            │    IdP (Okta / Azure AD …)   │  ← real user identity
                            └──────────────┬───────────────┘
                                           │ OIDC
                            ┌──────────────▼───────────────┐
                            │    IRSForge auth service     │  ← mints Canton ledger JWTs
                            │   /auth/* + /.well-known/    │     (JWKS that participants trust)
                            └──────┬───────────────────┬───┘
                                   │                   │
                                   │ oauth2            │ Bearer JWT
                                   │ client-credentials│
                            ┌──────▼─────┐    ┌────────▼─────────┐
                            │   Oracle   │    │     Frontend     │
                            │ (Scheduler │    │  Next.js + React │
                            │ + Operator │    │   /api/ledger    │
                            │   parties) │    │     proxy        │
                            └──────┬─────┘    └────────┬─────────┘
                                   │                   │
                                   ▼                   ▼
                            ┌─────────────────────────────────────┐
                            │   Canton participant(s) + JSON API   │
                            │   ─────────────────────────────────  │
                            │   PartyA   PartyB   Operator         │
                            │              Regulator (observer)    │
                            │              Scheduler (automation)  │
                            │   ─────────────────────────────────  │
                            │   Daml Finance V0 swap factories     │
                            │   IRSForge proposal / workflow /     │
                            │     CSA / oracle templates           │
                            └─────────────────────────────────────┘
```

Five logical parties, three services, one DAR, one YAML. In `sandbox` topology every party shares one participant; in `network` topology each org runs its own. Same DAR either way. See [Topology](./concepts/topology).

## Reference content

- **[Comparison](./comparison)**: vs Bloomberg MARS, AcadiaSoft, IHS Markit, off-chain clearing.
- **[FAQ](./faq)**: procurement-grade answers (license, support model, adoption status, vendor risk).
- **[Getting Started](./getting-started/quickstart)**: install, run, see it work.
- **[Concepts](./concepts/demo-vs-production)**: how the system is wired and why.
- **[UI](./ui/overview)**: every page, every button, every modal.
- **[Reference](./reference/config-yaml)**: full `irsforge.yaml` schema, every key documented.
