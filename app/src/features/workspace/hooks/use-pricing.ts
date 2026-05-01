'use client'

import type {
  CurveBook,
  DiscountCurve,
  FloatingRateIndex,
  PricingContext,
  RateObservation,
  SwapConfig,
  ValuationResult,
} from '@irsforge/shared-pricing'
import { pricingEngine } from '@irsforge/shared-pricing'
import { useMemo } from 'react'

export interface UsePricingOptions {
  /** Per-currency curve routing; XCCY requires this. */
  book?: CurveBook | null
  /** Pair-keyed FX spots for reporting-ccy NPV translation. */
  fxSpots?: Record<string, number>
  /** Currency the engine should report NPV in. Defaults to leg-0 currency. */
  reportingCcy?: string
}

export function usePricing(
  swapConfig: SwapConfig | null,
  curve: DiscountCurve | null,
  index: FloatingRateIndex | null = null,
  observations: RateObservation[] = [],
  indicesByLeg?: (FloatingRateIndex | null)[],
  options: UsePricingOptions = {},
) {
  const { book, fxSpots, reportingCcy } = options
  const valuation = useMemo<ValuationResult | null>(() => {
    if (!swapConfig || !curve || swapConfig.legs.length === 0) return null
    const ctx: PricingContext = {
      curve,
      index,
      observations,
      indicesByLeg,
      book: book ?? undefined,
      fxSpots,
      reportingCcy,
    }
    try {
      return pricingEngine.price(swapConfig, ctx)
    } catch {
      return null
    }
  }, [swapConfig, curve, index, observations, indicesByLeg, book, fxSpots, reportingCcy])

  return { valuation }
}
