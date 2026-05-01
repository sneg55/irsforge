import { z } from 'zod'

// CSA (Credit Support Annex) parameters. One CSA per counterparty pair governs
// VM exchange: threshold (per-direction tolerance for being uncollateralised),
// MTA (minimum transfer amount), rounding (call increment), valuation currency,
// and the eligible-collateral whitelist (currency + haircut). Phase 5 ships
// haircut == 1.0 always; the schema admits (0, 1] for forward-compat.
export const eligibleCollateralSchema = z.object({
  currency: z.string().length(3),
  haircut: z.number().positive().max(1),
})

export const csaSchema = z.object({
  threshold: z.object({
    DirA: z.number().nonnegative(),
    DirB: z.number().nonnegative(),
  }),
  mta: z.number().nonnegative(),
  rounding: z.number().nonnegative(),
  valuationCcy: z.string().length(3),
  eligibleCollateral: z.array(eligibleCollateralSchema).min(1),
})

// Demo-only initial pool funding per ccy (face value, applied symmetrically
// to both sides of every seeded CSA). Keyed by ISO ccy code; absent under
// `profile: production` (see configSchema.superRefine).
export const demoCsaSchema = z.object({
  initialFunding: z.record(z.string().length(3), z.number().positive()),
})

// ISDA Master Agreement registry. Real banks sign one MA per counterparty
// pair (per jurisdiction) and reference it across every CSA, swap, and
// trade beneath it. This is pair-level metadata, not per-CSA — keeping it
// in YAML config means traders pick the counterparty and the MA + governing
// law fill in automatically. The on-chain `Csa.isdaMasterAgreementRef` is
// still free `Text`, so deployments without a registered MA fall back to
// free-text entry on the proposal form.
export const masterAgreementSchema = z.object({
  parties: z.tuple([z.string().min(1), z.string().min(1)]),
  reference: z.string().min(1),
  governingLaw: z.enum(['NewYork', 'English', 'Japanese']),
})
