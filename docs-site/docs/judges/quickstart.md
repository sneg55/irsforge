---
title: Quickstart for Judges
sidebar_label: Quickstart
---

# Quickstart for judges

IRSForge is an on-chain Interest Rate Swap platform for [Canton Network](https://www.canton.network/). Built for **HackCanton Season #1 (Track 1, RWA & Business Workflows)** and engineered as a **reference open-source implementation** real Canton participants can adopt.

Five product families (IRS, OIS, Basis, XCCY, CDS) on the full Daml Finance stack. Signed-CSB margin model. Oracle-driven 24/7 lifecycle. FpML round-tripping. Regulator wired in as observer at contract creation.

:::tip[What you'll see in 5 minutes]
Six steps that exercise the full swap lifecycle on a real Canton sandbox: **propose → accept → trigger → settle → margin call → dispute → resolve**. Same code path as production, only providers and seeded data differ.
:::

:::info[Open the demo]
**[demo.irsforge.com →](https://demo.irsforge.com)** Live Canton sandbox with seeded parties and trades. No install, no clone, no setup.

**[Source on GitHub →](https://github.com/sneg55/irsforge)** if you want to read it before clicking.
:::

## 5-minute click-through

### 1. Pick a party

Land on `/`, click **Goldman Sachs**, then **Log in as PartyA** on the per-org auth screen.

![Party selector](/img/ui/demo/demo--party-selector.png)

### 2. Workspace, propose an IRS

You'll land on `/org/goldman/blotter`. Click **New Swap** to open the workspace draft. Pick **IRS** in the top bar. Set notional = 100M, tenor = 5Y. The right panel reprices live:

- **Cashflows**: quarterly schedule, DFs, PVs.
- **Risk**: DV01, theta.
- **Solver**: fair coupon (sets NPV ≈ 0).

Click **Propose** in the **On-chain** tab. Trade is now on-chain awaiting B's accept.

![Workspace](/img/ui/workspace/workspace--irs-composer.png)

### 3. Accept as JPMorgan

**Logout** (top-right), pick **JPMorgan**, log in. Land on `/org/jpmorgan/blotter`. Open the proposed trade row → **Accept**.

![Blotter](/img/ui/blotter/blotter--full.png)

### 4. Watch the lifecycle

The oracle's scheduler now drives the trade. Within seconds:

- The blotter NPV cell updates.
- The CSA mark sparkline ticks.
- If the mark crosses MTA, a margin call appears on `/org/<id>/csa`.

### 5. Post collateral

Go to `/org/<id>/csa`, open the active CSA drawer, click **Post**, pick USD, enter the call amount, submit.

![CSA](/img/ui/csa/csa--drawer-active.png)

### 6. Dispute, resolve

As Goldman: open the CSA drawer → **Dispute** with a counter value. CSA flips to `MarkDisputed`.

Logout, log in as **Operator**, go to `/org/operator/csa`. The drawer now shows the resolve action. Click. CSA returns to `Active`.

![CSA, operator resolve](/img/ui/csa/csa--operator-resolve.png)

## What you've just seen

A judge-grade summary of what each click exercised:

- **Five-stage swap lifecycle** (propose → accept → trigger → settle → mature) on real **Daml Finance V0** swap factories. Not reimplemented.
- **Signed-CSB margin model**: one signed per-currency balance per CSA pair. Same convention as Bloomberg MARS, AcadiaSoft, and ISDA-compliant CSAs. Phantom-call bugs are structurally impossible (see [CSA Model](../concepts/csa-model)).
- **Six-value dispute taxonomy** with a separate `DisputeRecord` audit-trail contract. Counterparty `AgreeToCounterMark` lets disputes resolve bilaterally without operator. Operator `AcknowledgeDispute` exists for escalation only.
- **Scheduler authority via sister `*ByScheduler` choices**, closing the Daml-2.x disjunctive-controller gap (Daml 2.x has no `controller a | b`).
- **Regulator as observer at contract creation**, not as a quarterly export. Sub-transaction privacy is a Canton property.
- **41 Daml test files**, **200+ TS unit/integration tests**, CI lint enforcement, coverage gates per workspace.
- **One DAR**, **one YAML** (`irsforge.yaml`), **`profile: demo | production`** as the only switch between this sandbox and a real Canton network deployment.

## Where to go next

**For judges and engineers:**

- **[Annotated tour](./tour)**: narrated walkthrough that explains *why* each surface exists (yaml-first design, signed-CSB rationale, scheduler-as-its-own-party, FpML).
- **[Comparison](../comparison)**: vs Bloomberg MARS, AcadiaSoft, MarkitWire, cleared swaps, forking Daml Finance directly.
- **[How it fits together](../intro.md#how-it-fits-together)**: 5-party, 3-service, 1-DAR architecture diagram.

**For evaluation depth:**

- **[Demo vs Production](../concepts/demo-vs-production)**: what `profile: production` actually flips (auth, oracle providers, seeding, lifecycle policies).
- **[CSA Model](../concepts/csa-model)**: signed-CSB story in depth, including the dispute taxonomy and `DisputeRecord` audit pattern.
- **[`irsforge.yaml` reference](../reference/config-yaml)**: every key, every default.
- **[FAQ](../faq)**: procurement-grade answers (license, support model, adoption status, vendor risk, KYC/AML scope).
