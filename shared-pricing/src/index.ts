// Engine

export { between } from './attribution/between.js'
// Attribution — Phase 4 Stage E
export {
  type AttributionBreakdown,
  decompose,
  type LedgerEvent,
  type PricingSnapshot,
} from './attribution/decompose.js'
// Cashflows + day-count — used by blotter/workspace for display
export * from './engine/cashflows.js'

// Curve helpers — used by ledger hooks when decoding on-chain Curve contracts
export { discountFactor, interpolateZero } from './engine/curves.js'
export * from './engine/day-count.js'
// FX helpers
export { fxFactor } from './engine/fx.js'
export { pricingEngine } from './engine/price.js'
// Types — everything app/ and oracle/ currently import
export type {
  AssetLegConfig,
  CashflowEntry,
  CurveBook,
  CurveDayCount,
  DayCountConvention,
  DiscountCurve,
  FixedLegConfig,
  FloatingRateCompounding,
  FloatingRateFamily,
  FloatingRateIndex,
  FloatLegConfig,
  Frequency,
  FxLegConfig,
  InterpolationMethod,
  LegConfig,
  LegDirection,
  PeriodicSchedule,
  PricingContext,
  PricingStrategy,
  ProtectionLegConfig,
  RateObservation,
  RatePoint,
  SwapConfig,
  SwapType,
  ValuationResult,
} from './engine/types.js'
export { dayCountBasisForFamily, TENOR_DAYS_MAP } from './engine/types.js'
export {
  buildBasisSwapConfig,
  buildIrsLikeSwapConfig,
  buildXccySwapConfig,
  mapDayCount,
  parsedFpmlToSwapConfig,
} from './fpml/build-config.js'
// FpML — Phase 6 Stage B (lifted from app/src/features/fpml-import).
// XML-free classifier; both the frontend importer and the oracle replay
// path consume this so the on-chain Fpml instrument's `swapStreams`
// field can be routed through the same taxonomy logic.
export { classify } from './fpml/classify.js'
export {
  type FpmlSwapStreamPayload,
  streamsToParsedFpml,
  streamToParsedLeg,
} from './fpml/stream-payload.js'
export type {
  Classification,
  FpmlCompounding,
  ParsedFpml,
  ParsedLeg,
  ParsedRateType,
  SupportedProduct,
} from './fpml/types.js'
export { accrued, clean, dirty } from './risk/accrued.js'
// Risk engine — Phase 4 Stage B
export {
  bumpCreditSpread,
  bumpFxSpot,
  bumpParallel,
  bumpPillar,
  bumpSingleProjection,
} from './risk/bump.js'
export {
  basisDv01,
  credit01,
  crossIndexBasisDv01,
  fxDelta,
  type KeyRateDv01Entry,
  keyRateDv01,
  projectionDv01,
} from './risk/metrics.js'
// Risk engine — Phase 4 Stage C (time metrics)
export {
  advanceAsOf,
  carry,
  forwardNpv,
  type Horizon,
  resolveHorizon,
  roll,
  theta,
} from './risk/time.js'
export { type HedgeObjective, solveHedgeNotional } from './solver/hedge-notional.js'
// Solver — Phase 4 Stage D
export { type NewtonOptions, type NewtonResult, solveNewton } from './solver/newton.js'
export { solveParRate } from './solver/par-rate.js'
export { solveSpread } from './solver/spread.js'
export { solveUnwindPv } from './solver/unwind-pv.js'
