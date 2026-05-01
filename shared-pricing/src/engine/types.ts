export type DayCountConvention = 'ACT_360' | 'ACT_365' | 'THIRTY_360' | 'THIRTY_E_360'
export type Frequency = 'Monthly' | 'Quarterly' | 'SemiAnnual' | 'Annual'
export type SwapType = 'IRS' | 'OIS' | 'BASIS' | 'XCCY' | 'CDS' | 'CCY' | 'FX' | 'ASSET' | 'FpML'

export interface CashflowEntry {
  date: Date
  amount: number
  discountFactor?: number
  projectedRate?: number
  /** Cross-currency strategies tag each cashflow with its payment currency. */
  currency?: string
}
export interface RatePoint {
  tenorLabel: string
  tenorDays: number
  rate: number
}

export type InterpolationMethod = 'LinearZero' | 'LogLinearDF'
export type CurveDayCount = 'Act360' | 'Act365F'

export interface DiscountCurve {
  currency: string
  curveType: 'Discount' | 'Projection'
  indexId: string | null
  asOf: string
  pillars: { tenorDays: number; zeroRate: number }[]
  interpolation: InterpolationMethod
  dayCount: CurveDayCount
}

/**
 * Per-currency curve routing for cross-currency products. Each currency
 * key carries its own discount curve (for PV) and a map of projection
 * curves keyed by indexId (for forward rates on float legs). Strategies
 * that price across currencies (XCCY today; dual-curve bootstrapping
 * later) read from here; single-currency strategies can keep using
 * `PricingContext.curve`. Use `resolveProjection` from
 * `engine/strategies/resolve-projection` to look up the right projection
 * by (currency, indexId) with a clean fallback chain.
 */
export interface CurveBook {
  asOf: string
  byCurrency: Record<
    string,
    {
      discount: DiscountCurve
      /** Projection curves keyed by indexId (e.g. 'USD-SOFR', 'USD-EFFR'). */
      projections: Record<string, DiscountCurve>
    }
  >
}
export interface PeriodicSchedule {
  startDate: Date
  endDate: Date
  frequency: Frequency
}

export type LegDirection = 'pay' | 'receive'

export interface FixedLegConfig {
  legType: 'fixed'
  direction: LegDirection
  currency: string
  notional: number
  rate: number
  dayCount: DayCountConvention
  schedule: PeriodicSchedule
}
export interface FloatLegConfig {
  legType: 'float'
  direction: LegDirection
  currency: string
  notional: number
  indexId: string
  spread: number
  dayCount: DayCountConvention
  schedule: PeriodicSchedule
}
export interface ProtectionLegConfig {
  legType: 'protection'
  direction: LegDirection
  notional: number
  recoveryRate: number
}
export interface AssetLegConfig {
  legType: 'asset'
  direction: LegDirection
  notional: number
  underlyings: { assetId: string; weight: number; initialPrice: number; currentPrice: number }[]
}
export interface FxLegConfig {
  legType: 'fx'
  direction: LegDirection
  baseCurrency: string
  foreignCurrency: string
  notional: number
  fxRate: number
  paymentDate: Date
}
export type LegConfig =
  | FixedLegConfig
  | FloatLegConfig
  | ProtectionLegConfig
  | AssetLegConfig
  | FxLegConfig

export interface SwapConfig {
  type: SwapType
  legs: LegConfig[]
  tradeDate: Date
  effectiveDate: Date
  maturityDate: Date
  /** CDS-only: annualised hazard rate (dimensionless; 0.02 = 200bp). */
  creditSpread?: number
}
export interface ValuationResult {
  npv: number
  legPVs: number[]
  dv01: number
  parRate: number | null
  cashflows: CashflowEntry[][]
  modDuration: number | null
  convexity: number | null
}
export interface PricingContext {
  curve: DiscountCurve
  /** Primary index — used by single-float-leg products (IRS, OIS, Asset). Null for fixed-only / CDS-only swaps. */
  index: FloatingRateIndex | null
  /**
   * Per-leg index overrides for multi-float products (BasisSwap, XCCY).
   * Index N applies to leg N. A `null` entry means the leg is fixed
   * (strategy ignores it). Strategies fall back to `index` when this
   * array is absent, so single-index products stay unchanged.
   */
  indicesByLeg?: (FloatingRateIndex | null)[]
  /** All `NumericObservation`s relevant to the float-leg accrual periods. Empty for forward-only legs. */
  observations: RateObservation[]
  /**
   * Per-currency curves for cross-currency products. XCCY requires this;
   * single-currency strategies can ignore it. Populated by `useCurveBook`
   * from the on-chain `Curve` contracts.
   */
  book?: CurveBook
  /**
   * Currency-pair spot rates, keyed `${baseCcy}${quoteCcy}` (e.g. "EURUSD").
   * Engine translates leg PVs from leg currency to `reportingCcy`.
   */
  fxSpots?: Record<string, number>
  /** Currency the engine returns NPV in. Defaults to the leg-0 currency. */
  reportingCcy?: string
  /**
   * Annualised hazard rate for CDS pricing. Dimensionless (0.02 = 200bp).
   * Defaults to `DEFAULT_CREDIT_SPREAD` in the CDS strategy when absent,
   * which preserves pre-Stage-B CDS behaviour. `risk/bump.ts:bumpCreditSpread`
   * shifts this by the requested basis-point delta.
   */
  creditSpread?: number
  /**
   * Forward-NPV horizon. Strategies skip cashflows with date <= valueDate in
   * calcLegPV so theta/forwardNpv don't double-count same-day settlement.
   * Defaults to `new Date(ctx.curve.asOf)` when absent.
   */
  valueDate?: Date
}

export interface PricingStrategy {
  /**
   * Compute cashflows for one leg. `legIndex` is the leg's position in
   * `SwapConfig.legs`; BasisSwap-style strategies use it to look up
   * `ctx.indicesByLeg`. `config` carries trade-level fields (maturityDate,
   * creditSpread) that strategies like CDS need but which are not on the leg
   * itself. Single-index strategies can ignore both optional parameters.
   */
  calcLegCashflows(
    leg: LegConfig,
    ctx: PricingContext,
    legIndex?: number,
    config?: SwapConfig,
  ): CashflowEntry[]
  /**
   * Discount the leg's cashflows. `legIndex` is the leg's position in
   * `SwapConfig.legs`; cross-currency strategies use it to pick the right
   * per-currency discount curve out of `ctx.book`. Single-currency
   * strategies can omit the parameter.
   */
  calcLegPV(cashflows: CashflowEntry[], ctx: PricingContext, legIndex?: number): number
}

export type FloatingRateFamily =
  | 'SOFR'
  | 'ESTR'
  | 'SONIA'
  | 'TONA'
  | 'SARON'
  | 'TIIE'
  | 'CORRA'
  | 'BBSW'
  | 'HONIA'

export type FloatingRateCompounding = 'Simple' | 'CompoundedInArrears' | 'OvernightAverage'

export interface FloatingRateIndex {
  indexId: string
  currency: string
  family: FloatingRateFamily
  compounding: FloatingRateCompounding
  /** Number of publication days to shift the observation window back by. NOT calendar days. */
  lookback: number
  floor: number | null
}

export interface RateObservation {
  date: Date
  rate: number
}

export function dayCountBasisForFamily(f: FloatingRateFamily): number {
  if (f === 'SONIA' || f === 'TONA') return 365
  return 360
}

export const TENOR_DAYS_MAP: Record<string, { tenorLabel: string; tenorDays: number }> = {
  'SOFR/ON': { tenorLabel: 'ON', tenorDays: 1 },
  'SOFR/1M': { tenorLabel: '1M', tenorDays: 30 },
  'SOFR/3M': { tenorLabel: '3M', tenorDays: 91 },
  'SOFR/6M': { tenorLabel: '6M', tenorDays: 182 },
  'SOFR/1Y': { tenorLabel: '1Y', tenorDays: 365 },
  'SOFR/2Y': { tenorLabel: '2Y', tenorDays: 730 },
  'SOFR/3Y': { tenorLabel: '3Y', tenorDays: 1095 },
  'SOFR/5Y': { tenorLabel: '5Y', tenorDays: 1826 },
  'SOFR/10Y': { tenorLabel: '10Y', tenorDays: 3652 },
}
