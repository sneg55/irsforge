---
title: Annotated Tour
---

# Annotated tour

A narrated walkthrough that explains **why** IRSForge is shaped the way it is. Seven design decisions a Canton participant or hackathon judge is most likely to ask about, with the rationale and the trade-off behind each one.

:::tip[How to read this]
Pair this page with [Quickstart](./quickstart): the quickstart shows _what_ to click; this page explains _why_ each surface exists. Each section is self-contained, skim freely.
:::

:::info[Run it while you read]
**[demo.irsforge.com →](https://demo.irsforge.com)** Live Canton sandbox. Most of these decisions become obvious once you've clicked the corresponding surface.
:::

## The yaml-first design

Everything is driven by **`irsforge.yaml`** at the repo root. One file. `profile: demo | production` is the only switch between "runs offline on a laptop" and "deploys against real Canton participants with OIDC and live curve feeds."

**Why:** a participant evaluating Canton should be able to read **one** config file and see exactly what they need to provide for production. The demo isn't a separate codebase, it's the same code with stub providers.

See [Demo vs Production](../concepts/demo-vs-production) and the [`irsforge.yaml` reference](../reference/config-yaml).

## Why a Workspace separate from a Blotter

Trading screens (`/workspace`) and risk screens (`/blotter`) have different rhythms:

- Workspace is **draft-first**: most of what you compose never lands on-chain. It's a pricing surface.
- Blotter is **live-first**: every row is on-chain.

What-If on the blotter (a temporary draft cloned from a live position) bridges the two without conflating them. The Workspace mirrors Bloomberg SWPM; the Blotter mirrors MARS. A trader who already runs both shouldn't have to relearn the rhythm.

See [Workspace](../ui/workspace) and [Blotter](../ui/blotter).

## Why signed Credit Support Balance, not two pools

Earlier iterations tracked `postedByA` and `postedByB` separately. That model admitted a state real CSAs never reach (both sides simultaneously posted) and produced **phantom margin calls on the wrong side** when one side over-posted.

The signed-CSB model (one signed per-currency balance per pair) is what Bloomberg MARS, AcadiaSoft, and real ISDA CSAs use. It makes the bug structurally impossible.

See [CSA Model](../concepts/csa-model).

## Why the scheduler is its own party

Lifecycle and settlement choices need a Daml signatory. Hardcoding `Operator` would conflate "platform admin" with "automated cron driver," which is bad for audit and bad for credential rotation.

`Scheduler` is a separate party with its own JWT. Daml 2.x has no disjunctive controllers (`controller a | b` doesn't exist), so we ship **sister `*ByScheduler` choices** for every effect the scheduler needs. Same body helper, different controller. The audit trail records which party drove each lifecycle event.

See [Scheduler](../oracle/scheduler).

## Why the demo curve ticker exists

Canton's `PublishDiscountCurve` archives the previous `Curve` contract on every publish. The ACS holds **exactly one** curve per key. Without something tickling the curves during a demo, the blotter's Trend column would be flat.

The ticker re-publishes seeded curves with bp-noise on a cron. Purely cosmetic, demo-only, vanishes in production where real provider feeds tick the curves.

See [Demo Curve Ticker](../oracle/demo-curve-ticker).

## Why the manual override toggle

`scheduler.manualOverridesEnabled: true` (demo) exposes "Trigger / Settle / Mature" buttons in the UI so a human can drive the demo deterministically. In production it's `false`: buttons hidden, scheduler is the only path.

The contracts don't change. Both code paths exist in Daml (manual `Trigger` vs sister `TriggerByScheduler`). The toggle is UI-only. A judge who wants to see five lifecycle stages in 30 seconds uses the manual buttons; a production deployment never exposes them.

## Why FpML

Every existing IR-derivatives platform (Bloomberg, IHS Markit, ICE) speaks FpML. Round-trip FpML import/export means a Canton-resident swap can be moved into and out of off-chain systems without manual re-keying. This is the primary integration path during a coexistence period where some books are on-chain and some are not.

See [FpML Import / Export](../ui/fpml-import-export).

:::note[What's intentionally out of scope, today]
Honest about the gaps. None of these are blocked on Canton or Daml Finance, all are scoped follow-ups.

- **Live providers** for EFFR, FX, and credit curves: Phase 9 follow-up. Until then those flows use `demo.*` stubs through the same `OracleProvider` seam SOFR uses.
- **Bilateral CSA proposal**: current init seeds CSAs at boot via `submitMulti`. Production deployments will want a `CsaProposal` template (mirror of `CdsProposal`).
- **Holiday calendars / business-day adjustments**: IRSForge runs 24/7 on-chain. Calendars are informational only, by design.
- **Initial Margin (SIMM)**: variation margin only today. SIMM is integrator scope.
- **XVA, swaptions, caps/floors, CMS, portfolio compression**: out of scope vs Bloomberg MARS. Tracked in the [SWPM/MARS parity gap list](../concepts/swpm-parity#whats-missing-vs-swpmmars-known-gaps).
:::
