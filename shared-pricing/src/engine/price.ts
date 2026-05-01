import { bumpParallel } from './bump-parallel.js'
import { fxFactor } from './fx.js'
import { AssetSwapPricingStrategy } from './strategies/asset-swap.js'
import { BasisSwapPricingStrategy } from './strategies/basis-swap.js'
import { CcySwapPricingStrategy } from './strategies/ccy-swap.js'
import { CdsPricingStrategy } from './strategies/cds.js'
import { FpmlPricingStrategy } from './strategies/fpml.js'
import { FxSwapPricingStrategy } from './strategies/fx-swap.js'
import { IrsPricingStrategy } from './strategies/irs.js'
import { XccyFixedFloatPricingStrategy } from './strategies/xccy.js'
import type {
  LegConfig,
  PricingContext,
  PricingStrategy,
  SwapConfig,
  SwapType,
  ValuationResult,
} from './types.js'

const strategies: Record<string, PricingStrategy> = {
  IRS: new IrsPricingStrategy(),
  // OIS reuses the IRS strategy: fixed leg + compounded-in-arrears float
  // leg with the same CashflowEntry shape. The only divergence is the
  // annual payment frequency on the config, which flows through
  // `scheduleFromDates` / SWAP_TYPE_CONFIGS.OIS.defaultLegs.
  OIS: new IrsPricingStrategy(),
  BASIS: new BasisSwapPricingStrategy(),
  XCCY: new XccyFixedFloatPricingStrategy(),
  CDS: new CdsPricingStrategy(),
  CCY: new CcySwapPricingStrategy(),
  FX: new FxSwapPricingStrategy(),
  ASSET: new AssetSwapPricingStrategy(),
  FpML: new FpmlPricingStrategy(),
}

/**
 * Single source of truth for resolving a swap type to its pricing strategy.
 * Both the engine and downstream modules (e.g. `risk/accrued.ts`) route
 * through this helper so adding a new `SwapType` only touches the map above.
 */
export function getStrategy(type: SwapType): PricingStrategy {
  const strategy = strategies[type]
  if (!strategy) {
    throw new Error(`No pricing strategy registered for swap type: ${type}`)
  }
  return strategy
}

function legCurrency(leg: LegConfig): string | null {
  if ('currency' in leg) return leg.currency
  if ('baseCurrency' in leg) return leg.baseCurrency
  return null
}

function directionSign(leg: LegConfig): 1 | -1 {
  return leg.direction === 'pay' ? -1 : 1
}

function priceWithContext(config: SwapConfig, ctx: PricingContext): number {
  const strategy = getStrategy(config.type)
  const reportingCcy = ctx.reportingCcy ?? legCurrency(config.legs[0]) ?? 'USD'
  return config.legs.reduce((sum, leg, i) => {
    const cfs = strategy.calcLegCashflows(leg, ctx, i, config)
    const pvLocal = strategy.calcLegPV(cfs, ctx, i)
    const signed = directionSign(leg) * pvLocal
    if (config.type === 'XCCY') {
      const ccy = legCurrency(leg) ?? reportingCcy
      return sum + signed * fxFactor(ccy, reportingCcy, ctx.fxSpots ?? {})
    }
    return sum + signed
  }, 0)
}

function calcRiskMetrics(config: SwapConfig, ctx: PricingContext, npv: number) {
  const bp = 0.0001
  const pvUp = priceWithContext(config, bumpParallel(ctx, bp))
  const pvDown = priceWithContext(config, bumpParallel(ctx, -bp))

  const dv01 = Math.abs(pvUp - pvDown) / 2
  const modDuration = npv !== 0 ? -((pvUp - pvDown) / (2 * bp)) / npv : null
  const convexity = npv !== 0 ? (pvUp + pvDown - 2 * npv) / (npv * bp * bp) : null

  return { dv01, modDuration, convexity }
}

export const pricingEngine = {
  price(config: SwapConfig, ctx: PricingContext): ValuationResult {
    const strategy = getStrategy(config.type)
    const reportingCcy = ctx.reportingCcy ?? legCurrency(config.legs[0]) ?? 'USD'
    const cashflows = config.legs.map((leg, i) => strategy.calcLegCashflows(leg, ctx, i, config))
    const legPVs = cashflows.map((cfs, i) => {
      const leg = config.legs[i]
      const pvLocal = strategy.calcLegPV(cfs, ctx, i)
      const signed = directionSign(leg) * pvLocal
      if (config.type === 'XCCY') {
        const ccy = legCurrency(leg) ?? reportingCcy
        return signed * fxFactor(ccy, reportingCcy, ctx.fxSpots ?? {})
      }
      return signed
    })
    const npv = legPVs.reduce((a, b) => a + b, 0)
    const { dv01, modDuration, convexity } = calcRiskMetrics(config, ctx, npv)

    // Par rate: the fixed rate that makes NPV = 0.
    // Uses signed PVs so the formula is direction-aware.
    // signedFixedPV = sign * fixedRate * fixedAnnuity
    // → fixedAnnuity = signedFixedPV / (sign * fixedRate) = signedFixedPV / (signedFixedPV / fixedAnnuity_unsigned)
    // Simpler: annuity = |signedFixedPV| / fixedRate  (sign cancels)
    // parRate = -otherPVSum / signedFixedAnnuity  where signedFixedAnnuity = signedFixedPV / fixedRate
    const fixedLegIdx = config.legs.findIndex((l) => l.legType === 'fixed')
    let parRate: number | null = null
    const fixedLeg = fixedLegIdx >= 0 ? config.legs[fixedLegIdx] : undefined
    if (fixedLeg?.legType === 'fixed' && fixedLeg.rate) {
      const signedFixedPV = legPVs[fixedLegIdx] // already signed
      const signedFixedAnnuity = signedFixedPV / fixedLeg.rate
      if (signedFixedAnnuity !== 0) {
        const otherPVSum = legPVs.reduce((s, pv, i) => (i === fixedLegIdx ? s : s + pv), 0)
        parRate = -otherPVSum / signedFixedAnnuity
      }
    }

    return { npv, legPVs, dv01, parRate, cashflows, modDuration, convexity }
  },
}
