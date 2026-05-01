/**
 * Default annualised hazard rate applied to CDS when `PricingContext.creditSpread`
 * is absent. Dimensionless (0.02 = 200bp). Consumed by:
 *   - `engine/strategies/cds.ts` — CDS pricing fallback
 *   - `risk/bump.ts`            — bumpCreditSpread fallback
 * Both must always resolve through this import so fallback behaviour stays
 * in lockstep.
 */
export const DEFAULT_CREDIT_SPREAD = 0.02
