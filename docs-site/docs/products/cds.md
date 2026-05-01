---
title: CDS — Credit Default Swap
sidebar_label: CDS
---

# CDS

Credit Default Swap. The protection buyer pays a periodic premium; the protection seller pays the loss-given-default if the reference name defaults during the trade's life.

The IRSForge CDS implements the **shape** (templates, lifecycle, settlement chain, regulator projection) and ships a **demo stub for pricing inputs**. Real credit data is an integrator concern — see the seam at the bottom of this page.

## Economics

| Leg | Side | Mechanic |
|---|---|---|
| Premium | buyer → seller | Quarterly fixed-rate payment on remaining notional |
| Contingent | seller → buyer | One-off `(1 - recovery) × notional` at default time |

```yaml
scheduleDefaults:
  CDS: { frequencyMonths: 3, dayCountConvention: Act360 }

cds:
  referenceNames:
    - TSLA
```

## On-chain template

Proposal: `Swap.CdsProposal`. Accept: `CdsAccept`. The reference name comes from `cds.referenceNames` (config-driven; add new names there, not in source).

## Pricing inputs (demo stub)

In demo profile, the stub provider emits two scalars per allowlisted reference name:

```yaml
demo:
  cdsStub:
    defaultProb: 0.02      # annual default probability (NOT a hazard rate)
    recovery:    0.40
```

These flow on-ledger as `Observation` rows under rate ids `CDS/<name>/DefaultProb` and `CDS/<name>/Recovery`. The pricing engine in `shared-pricing/src/engine/strategies/cds.ts` consumes them at face value — there is no term structure and no hazard bootstrap. That is intentional for a reference implementation: it gives the rest of the stack (templates, lifecycle, settlement, regulator audit) something deterministic to chase, without pretending to be a CDS pricing engine.

## Pricing identity

```
PV(premium leg)    = Σ DF(t) × spread × notional × accrual(t) × survivalProb(t)
PV(contingent leg) = ∫ DF(t) × (1 - recovery) × notional × dDefaultProb(t)

NPV(buyer) = PV(contingent) − PV(premium)
```

## Maturity-anchored discount

CDS pricing uses `maturityDate` as the discount anchor (not `today`) so the present value remains stable across days as the trade ages — this matches Bloomberg / standard CDS pricing convention.

## Observation gotcha

`Observation.observe` in Daml Finance is **exact-time `Map.lookup`** — `lastEventTimestamp` on the CDS instrument **must be grid-aligned** to a published observation, or evolve will fail with no observation found. The seed scripts ensure alignment; if you're authoring CDS instruments by hand, mind the grid.

## Bring your own credit feed

The `Oracle.Interface.Provider` interface that the demo stub implements is the **same seam** the NY Fed SOFR provider uses for rate data. To plug in a real credit feed (Markit, BVAL, ICE, an internal model):

1. Implement `Oracle.Interface.Provider` in a new Daml template — mirror `contracts/src/Oracle/NYFedProvider.daml`.
2. Add a TS adapter implementing `OracleProvider` in `oracle/src/providers/`, then `registerProvider` from `bootstrap-registrations.ts`.
3. Reference the new provider id from `irsforge.yaml`. The schema rejects unregistered ids at startup.

This is the same 3-step recipe documented in [Registering a Provider](../concepts/registering-a-provider). Replacing the stub is an integrator PR — the IRSForge code stays untouched. What we do **not** ship: ISDA Standard Model parity (flat-forward hazard, JPMCDS routines), credit-event lifecycle (DC auction outcomes triggering contingent payment), or any specific data-vendor adapter. Those are integrator scope.
