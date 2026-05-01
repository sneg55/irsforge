import type {
  AssetInstrumentPayload,
  CcyInstrumentPayload,
  CdsInstrumentPayload,
  FpmlInstrumentPayload,
  FxInstrumentPayload,
  IrsInstrumentPayload,
  SwapInstrumentPayload,
} from '@/shared/ledger/swap-instrument-types'
import type { SwapWorkflow } from '@/shared/ledger/types'
import type { LegConfig, SwapType } from '../types'
import {
  buildDates,
  dayCount,
  type HydratedWorkflow,
  num,
  parseDate,
} from './hydrate-workflow-helpers'

// Sister of hydrate-proposal-legs.ts: reconstructs workspace legs+dates from
// an active SwapWorkflow + its on-chain Instrument payload. Without this,
// clicking an Active blotter row leaves the workspace on its hardcoded IRS
// defaults (50M / 4.25% / 5Y) regardless of which trade was clicked.

// IRS/OIS share the InterestRate instrument template. The only divergence
// the workspace cares about is payment frequency — quarterly for IRS,
// annual for OIS — which the proposal hydrator also encodes by hand
// because `PeriodicSchedulePayload` doesn't expose `frequency`.
function hydrateInterestRate(
  swapType: 'IRS' | 'OIS',
  workflow: SwapWorkflow,
  instr: IrsInstrumentPayload,
): HydratedWorkflow {
  const effective = parseDate(instr.periodicSchedule.effectiveDate)
  const termination = parseDate(instr.periodicSchedule.terminationDate)
  const dates = buildDates(effective, termination)
  const schedule = {
    startDate: dates.effectiveDate,
    endDate: dates.maturityDate,
    frequency: swapType === 'OIS' ? ('Annual' as const) : ('Quarterly' as const),
  }
  const notional = num(workflow.notional)
  const dc = dayCount(instr.dayCountConvention)
  const currency = instr.currency.id.unpack
  const indexId = instr.floatingRate.referenceRateId
  const legs: LegConfig[] = [
    {
      legType: 'fixed',
      direction: 'receive',
      currency,
      notional,
      rate: num(instr.fixRate),
      dayCount: dc,
      schedule,
    },
    {
      legType: 'float',
      direction: 'pay',
      currency,
      notional,
      indexId,
      spread: 0,
      dayCount: dc,
      schedule,
    },
  ]
  return { swapType, legs, dates }
}

function hydrateCds(workflow: SwapWorkflow, instr: CdsInstrumentPayload): HydratedWorkflow {
  const effective = parseDate(instr.periodicSchedule.effectiveDate)
  const termination = parseDate(instr.periodicSchedule.terminationDate)
  const dates = buildDates(effective, termination)
  const schedule = {
    startDate: dates.effectiveDate,
    endDate: dates.maturityDate,
    frequency: 'Quarterly' as const,
  }
  const notional = num(workflow.notional)
  const legs: LegConfig[] = [
    {
      legType: 'fixed',
      direction: 'pay',
      currency: instr.currency.id.unpack,
      notional,
      rate: num(instr.fixRate),
      dayCount: dayCount(instr.dayCountConvention),
      schedule,
    },
    { legType: 'protection', direction: 'receive', notional, recoveryRate: 0.4 },
  ]
  return { swapType: 'CDS', legs, dates }
}

function hydrateCcy(workflow: SwapWorkflow, instr: CcyInstrumentPayload): HydratedWorkflow {
  const effective = parseDate(instr.periodicSchedule.effectiveDate)
  const termination = parseDate(instr.periodicSchedule.terminationDate)
  const dates = buildDates(effective, termination)
  const schedule = {
    startDate: dates.effectiveDate,
    endDate: dates.maturityDate,
    frequency: 'Quarterly' as const,
  }
  const notional = num(workflow.notional)
  const dc = dayCount(instr.dayCountConvention)
  const fxRate = num(instr.fxRate, 1)
  const legs: LegConfig[] = [
    {
      legType: 'fixed',
      direction: 'pay',
      currency: instr.baseCurrency.id.unpack,
      notional,
      rate: num(instr.baseRate),
      dayCount: dc,
      schedule,
    },
    {
      legType: 'fixed',
      direction: 'receive',
      currency: instr.foreignCurrency.id.unpack,
      notional: notional * fxRate,
      rate: num(instr.foreignRate),
      dayCount: dc,
      schedule,
    },
  ]
  return { swapType: 'CCY', legs, dates }
}

function hydrateFx(workflow: SwapWorkflow, instr: FxInstrumentPayload): HydratedWorkflow {
  const first = parseDate(instr.firstPaymentDate)
  const mat = parseDate(instr.maturityDate)
  const dates = buildDates(first, mat)
  const notional = num(workflow.notional)
  const legs: LegConfig[] = [
    {
      legType: 'fx',
      direction: 'pay',
      baseCurrency: instr.baseCurrency.id.unpack,
      foreignCurrency: instr.foreignCurrency.id.unpack,
      notional,
      fxRate: num(instr.firstFxRate, 1),
      paymentDate: first,
    },
    {
      legType: 'fx',
      direction: 'receive',
      baseCurrency: instr.baseCurrency.id.unpack,
      foreignCurrency: instr.foreignCurrency.id.unpack,
      notional,
      fxRate: num(instr.finalFxRate, 1),
      paymentDate: mat,
    },
  ]
  return { swapType: 'FX', legs, dates }
}

function hydrateAsset(workflow: SwapWorkflow, instr: AssetInstrumentPayload): HydratedWorkflow {
  const effective = parseDate(instr.periodicSchedule.effectiveDate)
  const termination = parseDate(instr.periodicSchedule.terminationDate)
  const dates = buildDates(effective, termination)
  const schedule = {
    startDate: dates.effectiveDate,
    endDate: dates.maturityDate,
    frequency: 'Quarterly' as const,
  }
  const notional = num(workflow.notional)
  const dc = dayCount(instr.dayCountConvention)
  const underlyings = instr.underlyings.map((u) => ({
    assetId: u.referenceAssetId,
    weight: num(u.weight, 1),
    initialPrice: num(u.initialPrice, 100),
    currentPrice: num(u.initialPrice, 100),
  }))
  const rateLeg: LegConfig = instr.floatingRate
    ? {
        legType: 'float',
        direction: 'pay',
        currency: instr.currency.id.unpack,
        notional,
        indexId: instr.floatingRate.referenceRateId,
        spread: 0,
        dayCount: dc,
        schedule,
      }
    : {
        legType: 'fixed',
        direction: 'pay',
        currency: instr.currency.id.unpack,
        notional,
        rate: num(instr.fixRate),
        dayCount: dc,
        schedule,
      }
  const legs: LegConfig[] = [
    { legType: 'asset', direction: 'receive', notional, underlyings },
    rateLeg,
  ]
  return { swapType: 'ASSET', legs, dates }
}

// BASIS / XCCY / FpML all back onto the same FpML instrument template; the
// individual leg shapes live in `swapStreams`. Each stream's
// `rateTypeValue.tag` discriminates fixed vs float; its
// `notionalStepSchedule` carries currency + initial notional.
function hydrateFpml(
  swapType: 'BASIS' | 'XCCY' | 'FpML',
  _workflow: SwapWorkflow,
  instr: FpmlInstrumentPayload,
): HydratedWorkflow {
  const stream0 = instr.swapStreams[0]
  const effective = stream0
    ? parseDate(stream0.calculationPeriodDates.effectiveDate.unadjustedDate)
    : new Date()
  const termination = stream0
    ? parseDate(stream0.calculationPeriodDates.terminationDate.unadjustedDate)
    : new Date()
  const dates = buildDates(effective, termination)
  const schedule = {
    startDate: dates.effectiveDate,
    endDate: dates.maturityDate,
    frequency: 'Quarterly' as const,
  }
  const legs: LegConfig[] = instr.swapStreams.map((s, i) => {
    const calc = s.calculationPeriodAmount.calculation
    const notionalRaw =
      calc.notionalScheduleValue.tag === 'NotionalSchedule_Regular'
        ? calc.notionalScheduleValue.value.notionalStepSchedule
        : null
    const notional = num(notionalRaw?.initialValue)
    const currency = String(notionalRaw?.currency ?? 'USD')
    const dc = dayCount(calc.dayCountFraction)
    const direction = i === 0 ? ('pay' as const) : ('receive' as const)
    if (calc.rateTypeValue.tag === 'RateType_Fixed') {
      return {
        legType: 'fixed',
        direction,
        currency,
        notional,
        rate: num(calc.rateTypeValue.value.initialValue),
        dayCount: dc,
        schedule,
      }
    }
    const float = calc.rateTypeValue.value
    return {
      legType: 'float',
      direction,
      currency,
      notional,
      indexId: String(float.floatingRateIndex),
      spread: num(float.spreadSchedule[0]?.initialValue),
      dayCount: dc,
      schedule,
    }
  })
  return { swapType, legs, dates }
}

export function hydrateWorkflowPayload(
  _swapType: SwapType,
  workflow: SwapWorkflow,
  instrument: SwapInstrumentPayload,
): HydratedWorkflow {
  switch (instrument.swapType) {
    case 'IRS':
    case 'OIS':
      return hydrateInterestRate(instrument.swapType, workflow, instrument.payload)
    case 'CDS':
      return hydrateCds(workflow, instrument.payload)
    case 'CCY':
      return hydrateCcy(workflow, instrument.payload)
    case 'FX':
      return hydrateFx(workflow, instrument.payload)
    case 'ASSET':
      return hydrateAsset(workflow, instrument.payload)
    case 'BASIS':
    case 'XCCY':
    case 'FpML':
      return hydrateFpml(instrument.swapType, workflow, instrument.payload)
    default: {
      const exhaustive: never = instrument
      throw new Error(`Unhandled swap family for hydrateWorkflowPayload: ${String(exhaustive)}`)
    }
  }
}
