// shared-pricing/src/attribution/decompose.ts

import { pricingEngine } from '../engine/price.js'
import type {
  CurveBook,
  DiscountCurve,
  FloatingRateIndex,
  PricingContext,
  RateObservation,
  SwapConfig,
} from '../engine/types.js'

export interface PricingSnapshot {
  asOf: string
  curve: DiscountCurve
  book?: CurveBook
  index: FloatingRateIndex | null
  /** Per-leg index overrides for multi-float products (BASIS / XCCY). Mirrors
   *  `PricingContext.indicesByLeg`. Ignored by single-float strategies. */
  indicesByLeg?: (FloatingRateIndex | null)[]
  fxSpots?: Record<string, number>
  creditSpread?: number
}

export type LedgerEvent =
  | { kind: 'observation'; indexId: string; date: string; rate: number }
  | { kind: 'cashflow'; currency: string; date: string; amount: number }

export interface AttributionBreakdown {
  total: number
  curve: number
  basis: number
  carry: number
  roll: number
  fixing: number
  unexplained: number
}

function asContext(snap: PricingSnapshot, observations: RateObservation[] = []): PricingContext {
  return {
    curve: snap.curve,
    index: snap.index,
    indicesByLeg: snap.indicesByLeg,
    observations,
    book: snap.book,
    fxSpots: snap.fxSpots,
    creditSpread: snap.creditSpread,
  }
}

function npv(config: SwapConfig, ctx: PricingContext): number {
  return pricingEngine.price(config, ctx).npv
}

function observationsFromEvents(events: LedgerEvent[]): RateObservation[] {
  return events
    .filter((e): e is Extract<LedgerEvent, { kind: 'observation' }> => e.kind === 'observation')
    .map((e) => ({ date: new Date(e.date), rate: e.rate }))
}

/**
 * Sequential-substitution attribution of ΔNPV between snapshots.
 *
 * Buckets, in evaluation order:
 *   carry + roll  — advance asOf (t0 → t1) using snap0 curves
 *   curve         — swap in snap1 discount curve, keep t0 projection/book
 *   basis         — swap in snap1 projection / book, keep new discount
 *   fixing        — apply observation events, keep snap1 curves
 *   unexplained   — residual (credit-spread / FX / cross-terms we do not split)
 *
 * Sum of buckets == total by construction. `total` is ΔNPV net of any
 * cashflow events paid in (t0, t1].
 */
export function decompose(
  config: SwapConfig,
  snap0: PricingSnapshot,
  snap1: PricingSnapshot,
  events: LedgerEvent[],
): AttributionBreakdown {
  const pv = (snap: PricingSnapshot, obs: RateObservation[] = []) =>
    npv(config, asContext(snap, obs))

  const pv0 = pv(snap0)
  const pv1 = pv(snap1, observationsFromEvents(events))

  const paidCash = events
    .filter((e): e is Extract<LedgerEvent, { kind: 'cashflow' }> => e.kind === 'cashflow')
    .filter((e) => e.date > snap0.asOf && e.date <= snap1.asOf)
    .reduce((s, e) => s + e.amount, 0)

  const total = pv1 - pv0 - paidCash

  // 1. time-only (carry + roll) — same curves, same index, asOf advances.
  const snapTime: PricingSnapshot = {
    ...snap0,
    asOf: snap1.asOf,
    curve: { ...snap0.curve, asOf: snap1.asOf },
    book: snap0.book
      ? {
          asOf: snap1.asOf,
          byCurrency: Object.fromEntries(
            Object.entries(snap0.book.byCurrency).map(([k, v]) => [
              k,
              {
                discount: { ...v.discount, asOf: snap1.asOf },
                projections: Object.fromEntries(
                  Object.entries(v.projections).map(([id, proj]) => [
                    id,
                    { ...proj, asOf: snap1.asOf },
                  ]),
                ),
              },
            ]),
          ),
        }
      : undefined,
  }
  const pvTime = pv(snapTime)

  // carry := -Σ paidCashflows in (t0, t1]; roll := rest of time-only ΔPV
  const carry = paidCash === 0 ? 0 : -paidCash
  const roll = pvTime - pv0 - carry

  // 2. curve — swap in snap1 discount only.
  const snapCurve: PricingSnapshot = {
    ...snapTime,
    curve: snap1.curve,
    book: snap1.book
      ? {
          asOf: snap1.book.asOf,
          byCurrency: Object.fromEntries(
            Object.entries(snap1.book.byCurrency).map(([k, v]) => {
              // Keep snap0's projections when available so the curve bucket
              // only reflects discount-curve changes; basis bucket picks up
              // the projection change in the next step.
              const snap0Projections = snap0.book?.byCurrency[k]?.projections
              return [
                k,
                {
                  discount: v.discount,
                  projections: snap0Projections ?? v.projections,
                },
              ]
            }),
          ),
        }
      : undefined,
  }
  const pvCurve = pv(snapCurve)
  const curve = pvCurve - pvTime

  // 3. basis — swap in snap1 projection / book.
  const snapBasis: PricingSnapshot = {
    ...snapCurve,
    book: snap1.book,
  }
  const pvBasis = pv(snapBasis)
  const basis = pvBasis - pvCurve

  // 4. fixing — apply observation events at snap1 state.
  const snapFixing: PricingSnapshot = { ...snapBasis, index: snap1.index }
  const pvFixing = pv(snapFixing, observationsFromEvents(events))
  const fixing = pvFixing - pvBasis

  // 5. unexplained — everything else (credit, fx spots, cross-terms).
  const unexplained = total - (curve + basis + carry + roll + fixing)

  return { total, curve, basis, carry, roll, fixing, unexplained }
}
