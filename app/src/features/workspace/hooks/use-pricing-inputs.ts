'use client'

import type {
  DiscountCurve,
  FloatingRateIndex,
  PricingContext,
  RateObservation,
  SwapConfig,
} from '@irsforge/shared-pricing'
import { useMemo } from 'react'
import { useOracleCurve } from '@/shared/hooks/use-oracle-curve'
import { useCurveBook } from '@/shared/ledger/useCurveBook'
import { type CurveStreamEntry, useCurveStream } from '@/shared/ledger/useCurveStream'
import { useFloatingRateIndex } from '@/shared/ledger/useFloatingRateIndex'
import { useFxSpots } from '@/shared/ledger/useFxSpots'
import { useObservations } from '@/shared/ledger/useObservations'

export interface PricingInputs {
  curve: DiscountCurve | null
  floatingRateIndex: FloatingRateIndex | null
  secondFloatingRateIndex: FloatingRateIndex | null
  indicesByLeg: (FloatingRateIndex | null)[] | undefined
  observations: RateObservation[]
  curveBook: PricingContext['book']
  fxSpots: Record<string, number>
  pricingCtx: PricingContext | null
  curveHistory: CurveStreamEntry[]
  streamStatus: 'idle' | 'connecting' | 'open' | 'fallback'
}

function liftIndex(
  data:
    | {
        indexId: string
        currency: string
        family: string
        compounding: string
        lookback: number
        floor: number | null
      }
    | null
    | undefined,
): FloatingRateIndex | null {
  if (!data) return null
  return {
    indexId: data.indexId,
    currency: data.currency,
    family: data.family as FloatingRateIndex['family'],
    compounding: data.compounding as FloatingRateIndex['compounding'],
    lookback: data.lookback,
    floor: data.floor,
  }
}

/**
 * Build every pricing input the workspace needs — curve, indices,
 * observations, XCCY book / FX spots, and the Stage E streaming ring
 * buffer — into one PricingContext + a few bare values the view layer
 * still reads.
 */
export function usePricingInputs(swapConfig: SwapConfig | null): PricingInputs {
  const { curve } = useOracleCurve()
  const { data: curveBookData } = useCurveBook()
  const { data: fxSpotsData } = useFxSpots()

  const floatLegs = swapConfig?.legs.filter((l) => l.legType === 'float') ?? []
  const floatIndexId = floatLegs[0]?.indexId ?? null
  const secondFloatIndexId =
    floatLegs.length > 1 && floatLegs[1]?.indexId !== floatIndexId
      ? (floatLegs[1]?.indexId ?? null)
      : null

  const { data: floatIndexData } = useFloatingRateIndex(floatIndexId ?? '')
  const { data: secondFloatIndexData } = useFloatingRateIndex(secondFloatIndexId ?? '')
  const { data: observationsData } = useObservations(floatIndexId)

  const floatingRateIndex = useMemo(() => liftIndex(floatIndexData), [floatIndexData])
  const secondFloatingRateIndex = useMemo(
    () => liftIndex(secondFloatIndexData),
    [secondFloatIndexData],
  )

  const indicesByLeg = useMemo<(FloatingRateIndex | null)[] | undefined>(() => {
    if (!swapConfig) return undefined
    let floatSeen = 0
    const out: (FloatingRateIndex | null)[] = []
    for (const leg of swapConfig.legs) {
      if (leg.legType !== 'float') {
        out.push(null)
        continue
      }
      if (floatSeen === 0) {
        out.push(floatingRateIndex)
      } else if (floatSeen === 1) {
        out.push(secondFloatingRateIndex ?? floatingRateIndex)
      } else {
        out.push(floatingRateIndex)
      }
      floatSeen += 1
    }
    return out
  }, [swapConfig, floatingRateIndex, secondFloatingRateIndex])

  const observations = observationsData ?? []
  const curveBook = curveBookData ?? undefined
  const fxSpots = fxSpotsData ?? {}

  const stream = useCurveStream('USD', 'Discount')

  const pricingCtx = useMemo<PricingContext | null>(() => {
    if (!curve) return null
    return {
      curve,
      index: floatingRateIndex,
      indicesByLeg,
      observations,
      book: curveBook,
      fxSpots,
      creditSpread: swapConfig?.creditSpread ?? 0.02,
    }
  }, [
    curve,
    floatingRateIndex,
    indicesByLeg,
    observations,
    curveBook,
    fxSpots,
    swapConfig?.creditSpread,
  ])

  return {
    curve,
    floatingRateIndex,
    secondFloatingRateIndex,
    indicesByLeg,
    observations,
    curveBook,
    fxSpots,
    pricingCtx,
    curveHistory: stream.history,
    streamStatus: stream.status,
  }
}
