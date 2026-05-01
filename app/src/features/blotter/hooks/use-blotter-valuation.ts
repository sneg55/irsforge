'use client'

import type { CurveBook, DiscountCurve, PricingContext, SwapConfig } from '@irsforge/shared-pricing'
import {
  parsedFpmlToSwapConfig,
  pricingEngine,
  streamsToParsedFpml,
} from '@irsforge/shared-pricing'
import { useMemo } from 'react'
import type {
  AssetInstrumentPayload,
  CcyInstrumentPayload,
  CdsInstrumentPayload,
  FpmlInstrumentPayload,
  FxInstrumentPayload,
  IrsInstrumentPayload,
  SwapInstrumentPayload,
} from '@/shared/ledger/swap-instrument-types'
import type { ContractResult, SwapWorkflow } from '@/shared/ledger/types'
import type { SwapType } from '../types'

/**
 * Build a complete pricer SwapConfig from the on-chain instrument payload.
 *
 * Drives off `swapType` passed by the caller rather than `instr.swapType`:
 * `useSwapInstruments` stamps the map value based on query iteration order,
 * and IRS+OIS (and BASIS+XCCY+FpML) share templates, so the stamped value
 * is whichever family's query finished last. The workflow always knows
 * its own swapType — pass it through.
 *
 * Returns null when the instrument shape is unsupported (classify rejects
 * the FpML stream, or a never-case is hit). The caller drops those rows
 * to "—" in the blotter.
 */
function instrumentToSwapConfig(
  notional: number,
  instr: SwapInstrumentPayload,
  swapType: SwapType,
): SwapConfig | null {
  switch (swapType) {
    case 'IRS':
    case 'OIS': {
      // Same on-chain template (InterestRate.Instrument); OIS differs only
      // in the coupon compounding convention, which the pricing engine
      // handles downstream via SWAP_TYPE_CONFIGS.
      const p = instr.payload as IrsInstrumentPayload
      const effectiveDate = new Date(p.periodicSchedule.effectiveDate)
      const maturityDate = new Date(p.periodicSchedule.terminationDate)
      const schedule = {
        startDate: effectiveDate,
        endDate: maturityDate,
        frequency: 'Quarterly' as const,
      }
      const dc = p.dayCountConvention === 'Act365Fixed' ? 'ACT_365' : 'ACT_360'
      return {
        type: swapType,
        legs: [
          {
            legType: 'fixed',
            direction: 'receive' as const,
            currency: p.currency.id.unpack,
            notional,
            rate: parseFloat(p.fixRate),
            dayCount: dc,
            schedule,
          },
          {
            legType: 'float',
            direction: 'pay' as const,
            currency: p.currency.id.unpack,
            notional,
            indexId: p.floatingRate.referenceRateId,
            spread: 0,
            dayCount: dc,
            schedule,
          },
        ],
        tradeDate: effectiveDate,
        effectiveDate,
        maturityDate,
      }
    }
    case 'CDS': {
      const p = instr.payload as CdsInstrumentPayload
      const effectiveDate = new Date(p.periodicSchedule.effectiveDate)
      const maturityDate = new Date(p.periodicSchedule.terminationDate)
      const schedule = {
        startDate: effectiveDate,
        endDate: maturityDate,
        frequency: 'Quarterly' as const,
      }
      const dc = p.dayCountConvention === 'Act365Fixed' ? 'ACT_365' : 'ACT_360'
      return {
        type: 'CDS',
        legs: [
          {
            legType: 'fixed',
            direction: 'pay' as const,
            currency: p.currency.id.unpack,
            notional,
            rate: parseFloat(p.fixRate),
            dayCount: dc,
            schedule,
          },
          // recoveryRate stays at 0.4 — Phase 4 wires the on-chain Recovery observation.
          { legType: 'protection', direction: 'receive' as const, notional, recoveryRate: 0.4 },
        ],
        tradeDate: effectiveDate,
        effectiveDate,
        maturityDate,
      }
    }
    case 'CCY': {
      const p = instr.payload as CcyInstrumentPayload
      const effectiveDate = new Date(p.periodicSchedule.effectiveDate)
      const maturityDate = new Date(p.periodicSchedule.terminationDate)
      const schedule = {
        startDate: effectiveDate,
        endDate: maturityDate,
        frequency: 'Quarterly' as const,
      }
      const dc = p.dayCountConvention === 'Act365Fixed' ? 'ACT_365' : 'ACT_360'
      const fxRate = parseFloat(p.fxRate)
      return {
        type: 'CCY',
        legs: [
          {
            legType: 'fixed',
            direction: 'pay' as const,
            currency: p.baseCurrency.id.unpack,
            notional,
            rate: parseFloat(p.baseRate),
            dayCount: dc,
            schedule,
          },
          {
            legType: 'fixed',
            direction: 'receive' as const,
            currency: p.foreignCurrency.id.unpack,
            notional: notional * fxRate,
            rate: parseFloat(p.foreignRate),
            dayCount: dc,
            schedule,
          },
        ],
        tradeDate: effectiveDate,
        effectiveDate,
        maturityDate,
      }
    }
    case 'FX': {
      const p = instr.payload as FxInstrumentPayload
      const effectiveDate = new Date(p.issueDate)
      const maturityDate = new Date(p.maturityDate)
      return {
        type: 'FX',
        legs: [
          {
            legType: 'fx',
            direction: 'pay' as const,
            baseCurrency: p.baseCurrency.id.unpack,
            foreignCurrency: p.foreignCurrency.id.unpack,
            notional,
            fxRate: parseFloat(p.firstFxRate),
            paymentDate: new Date(p.firstPaymentDate),
          },
          {
            legType: 'fx',
            direction: 'receive' as const,
            baseCurrency: p.baseCurrency.id.unpack,
            foreignCurrency: p.foreignCurrency.id.unpack,
            notional,
            fxRate: parseFloat(p.finalFxRate),
            paymentDate: new Date(p.maturityDate),
          },
        ],
        tradeDate: effectiveDate,
        effectiveDate,
        maturityDate,
      }
    }
    case 'ASSET': {
      const p = instr.payload as AssetInstrumentPayload
      const effectiveDate = new Date(p.periodicSchedule.effectiveDate)
      const maturityDate = new Date(p.periodicSchedule.terminationDate)
      const schedule = {
        startDate: effectiveDate,
        endDate: maturityDate,
        frequency: 'Quarterly' as const,
      }
      const dc = p.dayCountConvention === 'Act365Fixed' ? 'ACT_365' : 'ACT_360'
      return {
        type: 'ASSET',
        legs: [
          {
            legType: 'asset',
            direction: 'receive' as const,
            notional,
            underlyings: p.underlyings.map((u) => ({
              assetId: u.referenceAssetId,
              weight: parseFloat(u.weight),
              initialPrice: parseFloat(u.initialPrice),
              currentPrice: parseFloat(u.initialPrice),
            })),
          },
          {
            legType: 'fixed',
            direction: 'pay' as const,
            currency: p.currency.id.unpack,
            notional,
            rate: parseFloat(p.fixRate),
            dayCount: dc,
            schedule,
          },
        ],
        tradeDate: effectiveDate,
        effectiveDate,
        maturityDate,
      }
    }
    case 'BASIS':
    case 'XCCY':
    case 'FpML': {
      // Shared decoder from @irsforge/shared-pricing: stream → ParsedFpml
      // → classify → dispatch to the right builder. Throws on unclassifiable
      // streams; the caller's try/catch drops the row to "—" in that case.
      const p = instr.payload as FpmlInstrumentPayload
      return parsedFpmlToSwapConfig(streamsToParsedFpml(p.swapStreams))
    }
  }
}

export interface BlotterValuation {
  npv: number
  dv01: number
  sparkline: number[]
}

export function useBlotterValuation(
  workflows: ContractResult<SwapWorkflow>[],
  byInstrumentId: Map<string, SwapInstrumentPayload>,
  curve: DiscountCurve | null,
  book: CurveBook | null,
  fxSpots: Record<string, number>,
  curveHistory: DiscountCurve[] = [],
  maxSparklinePoints = 30,
) {
  return useMemo(() => {
    const valuations = new Map<string, BlotterValuation>()
    if (!curve) return valuations

    // Take the newest `maxSparklinePoints` curves in wall-clock order so the
    // sparkline reads left-to-right from oldest → newest. When the stream
    // hasn't opened yet the trend collapses to a single-point dot.
    const trendCurves =
      curveHistory.length === 0 ? [curve] : curveHistory.slice(-maxSparklinePoints)

    for (const w of workflows) {
      const instr = byInstrumentId.get(w.payload.instrumentKey.id.unpack)
      if (!instr) continue

      // Use the workflow's own swapType (not `instr.swapType`, which is
      // whichever family's query wrote the map value last).
      const swapType = w.payload.swapType as SwapType

      try {
        const config = instrumentToSwapConfig(parseFloat(w.payload.notional), instr, swapType)
        if (!config) continue

        // IRS/OIS/XCCY strategies resolve their discount curve off
        // `ctx.book.byCurrency[ccy].discount` and only fall back to
        // `ctx.curve` when no book is seeded. BASIS's `calcLegPV` is the
        // lone exception — it reads `ctx.curve` directly for discounting.
        // That asymmetry is why a historical curve passed only via
        // ctx.curve moves BASIS's sparkline but leaves everyone else
        // flat: the book stays pinned to the *current* discount curve
        // across every tick. Fix: substitute the historical discount
        // curve into a shallow-cloned book so every strategy sees the
        // same historical snapshot. Projection stays current for v1 —
        // animating projection requires pulling a second snapshot stream.
        const sparkline: number[] = []
        for (const c of trendCurves) {
          const historicalBook = book
            ? ((): typeof book => {
                const currentPair = book.byCurrency[c.currency]
                // Keep the current projection map, falling back to a
                // synthetic single-entry map so strategies that require at
                // least one projection (IRS, BASIS) still resolve.
                const projections: Record<string, typeof c> =
                  currentPair?.projections && Object.keys(currentPair.projections).length > 0
                    ? Object.fromEntries(
                        Object.entries(currentPair.projections).map(([id, proj]) => [id, proj]),
                      )
                    : { [c.indexId ?? 'default']: { ...c, curveType: 'Projection' as const } }
                return {
                  asOf: c.asOf,
                  byCurrency: {
                    ...book.byCurrency,
                    [c.currency]: { discount: c, projections },
                  },
                }
              })()
            : null
          const ctx: PricingContext = {
            curve: c,
            index: null,
            observations: [],
            ...(historicalBook ? { book: historicalBook } : {}),
            ...(Object.keys(fxSpots).length > 0 ? { fxSpots } : {}),
          }
          try {
            sparkline.push(pricingEngine.price(config, ctx).npv)
          } catch {
            /* skip this curve for this row */
          }
        }

        const ctx: PricingContext = {
          curve,
          index: null,
          observations: [],
          ...(book ? { book } : {}),
          ...(Object.keys(fxSpots).length > 0 ? { fxSpots } : {}),
        }
        const latest = pricingEngine.price(config, ctx)
        valuations.set(w.contractId, { npv: latest.npv, dv01: latest.dv01, sparkline })
      } catch {
        // Pricing failed — omit row
      }
    }

    return valuations
  }, [workflows, byInstrumentId, curve, book, fxSpots, curveHistory, maxSparklinePoints])
}
