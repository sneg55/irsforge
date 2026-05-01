---
title: Daml Finance Interfaces
sidebar_position: 1
---

# Daml Finance Interfaces

IRSForge consumes Daml Finance as a library. The page below maps every Daml Finance interface and concrete template that IRSForge imports, with file references into [`contracts/src/`](https://github.com/sneg55/irsforge/tree/main/contracts/src). Nothing on this list is reimplemented in IRSForge.

The list is grouped by Daml Finance domain. Within each group, "Used in" lists the IRSForge files that import the interface; for the production swap families this is the complete set, not a sample.

## Common types

`Daml.Finance.Interface.Types.Common.V3.Types`

The shared identifier and key types: `Id`, `InstrumentKey`, `AccountKey`, `HoldingStandard`, `Quantity`. Every IRSForge module that touches a Daml Finance contract imports from here.

- Used in: every proposal, settlement, audit, and oracle module across [`Swap/`](https://github.com/sneg55/irsforge/tree/main/contracts/src/Swap), [`Csa/`](https://github.com/sneg55/irsforge/tree/main/contracts/src/Csa), [`Audit/`](https://github.com/sneg55/irsforge/tree/main/contracts/src/Audit), [`Oracle/`](https://github.com/sneg55/irsforge/tree/main/contracts/src/Oracle), [`Setup/`](https://github.com/sneg55/irsforge/tree/main/contracts/src/Setup).

## Date and schedule conventions

`Daml.Finance.Interface.Types.Date.V3.{DayCount, Calendar, Schedule, RollConvention, DateOffset}`

ISDA-shaped date math. IRSForge consumes the conventions as shipped, no shadow types.

- `DayCount` (`DayCountConventionEnum`) — used in every per-family proposal: [`Proposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Proposal.daml), [`OisProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/OisProposal.daml), [`CdsProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/CdsProposal.daml), [`CcySwapProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/CcySwapProposal.daml), [`FxSwapProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/FxSwapProposal.daml), [`AssetSwapProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/AssetSwapProposal.daml), [`BasisSwapProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/BasisSwapProposal.daml), [`XccyFixedFloatProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/XccyFixedFloatProposal.daml).
- `Calendar` (`BusinessDayAdjustment`, `BusinessDayConventionEnum`, `HolidayCalendarData`) — used in [`Swap/TestHelpers.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/TestHelpers.daml), [`Setup/CashSetup.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/CashSetup.daml), [`Setup/InitImpl.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/InitImpl.daml).
- `Schedule` (`PeriodicSchedule`, `Frequency`, `ScheduleFrequency`) — used in every floating-leg-bearing proposal.
- `RollConvention` (`Period`, `PeriodEnum`, `RollConventionEnum`) — used across all proposals plus [`Swap/Types.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Types.daml).
- `DateOffset` (`DateOffset`, `DayTypeEnum`) — used in [`Proposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Proposal.daml), [`OisProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/OisProposal.daml), [`AssetSwapProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/AssetSwapProposal.daml).

Helper: `Daml.Finance.Util.V4.Date.RollConvention.addPeriod` — used in [`Swap/Types.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Types.daml) for ISDA-correct period arithmetic.

## Accounts

`Daml.Finance.Interface.Account.V4.{Account, Factory}`

Custodian-and-owner accounts. IRSForge consumes the interface; the concrete `Daml.Finance.Account.V4.Account` template is also instantiated for cash and instrument accounts during seeded setup.

- Used in: [`Setup/AddCurrency.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/AddCurrency.daml), [`Setup/CashSetup.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/CashSetup.daml).

## Holdings

`Daml.Finance.Interface.Holding.V4.{Holding, Fungible, Factory}`

Cash and asset holdings. IRSForge uses `Fungible` everywhere a swap moves cash, and `Holding` to inspect the underlying when batching settlements.

- `Fungible` — used in [`Swap/Settlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Settlement.daml), [`Swap/Workflow.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Workflow.daml), [`Swap/NettedSettlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/NettedSettlement.daml), [`Swap/Terminate.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Terminate.daml), [`Csa/Types.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Csa/Types.daml).
- `Holding` — used in [`Swap/Settlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Settlement.daml), [`Swap/NettedSettlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/NettedSettlement.daml), [`Swap/Terminate.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Terminate.daml).
- `Factory` — used in [`Setup/AddCurrency.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/AddCurrency.daml), [`Setup/CashSetup.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/CashSetup.daml).

Concrete template: `Daml.Finance.Holding.V4.TransferableFungible` is the holding implementation seeded by IRSForge's setup scripts; the production code path then operates against the `Fungible` interface only.

## Cash instruments

`Daml.Finance.Interface.Instrument.Token.V4.{Factory, Types}`

Used to mint cash instruments per currency at setup time. The concrete `Daml.Finance.Instrument.Token.V4.Factory` is instantiated for each YAML-defined currency; runtime code references the interface.

- Used in: [`Setup/AddCurrency.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/AddCurrency.daml), [`Setup/CashSetup.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/CashSetup.daml).

## Floating-rate primitives

`Daml.Finance.Interface.Instrument.Types.V2.FloatingRate`

`FloatingRate` and `ReferenceRateTypeEnum` (including `CompoundedIndex` for OIS-style indices).

- Used in: every floating-leg-bearing proposal across [`Swap/`](https://github.com/sneg55/irsforge/tree/main/contracts/src/Swap), plus [`Setup/TestSchedulerDelegationFixture.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/TestSchedulerDelegationFixture.daml).

## Swap instrument families

`Daml.Finance.Interface.Instrument.Swap.V0.*`

This is the heart of the consumption. IRSForge consumes one factory and one `Types` module per swap family, and instantiates the matching concrete factory at setup time. The `V0` namespace is what Digital Asset ships today.

| Family | Interface factory | Types | IRSForge proposal |
|---|---|---|---|
| Interest Rate | `InterestRate.Factory` | `InterestRate.Types` | [`Swap/Proposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Proposal.daml), [`Swap/OisProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/OisProposal.daml) |
| Credit Default | `CreditDefault.Factory` | `CreditDefault.Types` | [`Swap/CdsProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/CdsProposal.daml) |
| Currency | `Currency.Factory` | `Currency.Types` | [`Swap/CcySwapProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/CcySwapProposal.daml) |
| Foreign Exchange | `ForeignExchange.Factory` | `ForeignExchange.Types` | [`Swap/FxSwapProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/FxSwapProposal.daml) |
| Asset | `Asset.Factory` | `Asset.Types` | [`Swap/AssetSwapProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/AssetSwapProposal.daml) |
| FpML | `Fpml.Factory` | `Fpml.Types`, `Fpml.FpmlTypes` | [`Swap/FpmlProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/FpmlProposal.daml), [`Swap/BasisSwapProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/BasisSwapProposal.daml), [`Swap/XccyFixedFloatProposal.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/XccyFixedFloatProposal.daml), [`Swap/FpmlAdapter.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/FpmlAdapter.daml) |

All six factories are registered alongside their concrete implementations in [`Setup/InitImpl.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/InitImpl.daml) and [`Setup/CashSetup.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/CashSetup.daml).

## Lifecycle

`Daml.Finance.Interface.Lifecycle.V4.{Rule.Lifecycle, Event, Effect, Observable.NumericObservable}`

The Evolve engine. IRSForge wires its scheduler-authority sister choices around these interfaces; the lifecycle math is Daml Finance's.

- `Rule.Lifecycle` — used in [`Swap/Workflow.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Workflow.daml).
- `Event` — used in [`Swap/Workflow.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Workflow.daml).
- `Effect` — used in [`Swap/Workflow.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Workflow.daml), [`Swap/Settlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Settlement.daml), [`Swap/NettedSettlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/NettedSettlement.daml), [`Csa/Types.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Csa/Types.daml).
- `Observable.NumericObservable` — used in [`Swap/Workflow.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Workflow.daml).

Concrete: `Daml.Finance.Claims.V3.Lifecycle.Rule` is the claims-tree implementation, registered at setup and exercised by IRSForge's scheduler delegation.

## Settlement

`Daml.Finance.Interface.Settlement.V4.{Factory, RouteProvider, Batch, Instruction, Types}`

The Calculate to Discover to Instruct to Allocate-and-Approve to Settle chain. IRSForge does not reimplement this; it constructs the steps and exercises Daml Finance's choices.

- `Factory` — used in [`Swap/Workflow.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Workflow.daml), [`Swap/Settlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Settlement.daml), [`Swap/NettedSettlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/NettedSettlement.daml), [`Swap/Terminate.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Terminate.daml), [`Csa/Csa.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Csa/Csa.daml), [`Csa/Netting.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Csa/Netting.daml), [`Setup/CashSetup.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/CashSetup.daml).
- `RouteProvider` — used in the same modules as `Factory`.
- `Batch` — used in [`Swap/Workflow.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Workflow.daml), [`Swap/Settlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Settlement.daml), [`Swap/NettedSettlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/NettedSettlement.daml), [`Swap/Terminate.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Terminate.daml), [`Csa/Netting.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Csa/Netting.daml), [`Audit/SettlementAudit.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Audit/SettlementAudit.daml).
- `Instruction` — used in [`Swap/Settlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Settlement.daml), [`Swap/NettedSettlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/NettedSettlement.daml).
- `Types` (`Step`, `Allocation`, `Approval`) — used in [`Swap/Settlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Settlement.daml), [`Swap/NettedSettlement.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/NettedSettlement.daml), [`Swap/Terminate.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Swap/Terminate.daml).

Concrete: `Daml.Finance.Settlement.V4.Factory` and `Daml.Finance.Settlement.V4.RouteProvider.SingleCustodian` are instantiated by [`Setup/CashSetup.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/CashSetup.daml).

## Reference data

`Daml.Finance.Data.V4.{Numeric.Observation, Reference.HolidayCalendar, Time.DateClockUpdate}`

The on-ledger reference data primitives. IRSForge's [`Oracle/`](https://github.com/sneg55/irsforge/tree/main/contracts/src/Oracle) modules wrap `Observation` for rate publishing; `HolidayCalendar` and `DateClockUpdate` are used at setup time.

- `Numeric.Observation` — used in [`Oracle/Interface.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Oracle/Interface.daml), [`Oracle/NYFedProvider.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Oracle/NYFedProvider.daml).
- `Reference.HolidayCalendar` — used in [`Setup/InitImpl.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/InitImpl.daml).
- `Time.DateClockUpdate` — used in [`Setup/EventFactory.daml`](https://github.com/sneg55/irsforge/blob/main/contracts/src/Setup/EventFactory.daml).

## What we add, not what we replace

The interfaces above are everything IRSForge consumes. What sits on top of them, in IRSForge's own modules, is:

- Per-family proposal templates (`*Proposal.daml`) that compose Daml Finance factory choices into an Accept and ProposeAccept-AcceptAck flow.
- A scheduler-authority lifecycle path (`Swap/Workflow.daml`, sister choices like `TriggerLifecycleByScheduler`, `CreateFixingEventByScheduler`) that closes the Evolve-delegation gap without modifying Daml Finance's `Rule.Lifecycle`.
- A signed CSB collateral model (`Csa/Csa.daml`, `Csa/Netting.daml`) that uses Daml Finance's settlement chain underneath.
- An `Oracle.Interface.Provider` extension point so third parties can register data providers without forking IRSForge.
- A regulator-as-observer pattern threaded through every swap-related contract.

None of these reimplement Daml Finance. Each one consumes the interface as shipped.

## See also

- [Swap Lifecycle](../concepts/swap-lifecycle) — how the lifecycle stages map onto these interfaces.
- [Pricing and Curves](../concepts/pricing-and-curves) — how `NumericObservable` and `Observation` are used at runtime.
- [Registering a Provider](../concepts/registering-a-provider) — how `Oracle.Interface.Provider` extends the data layer.
