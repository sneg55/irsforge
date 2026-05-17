import { z } from 'zod'
import type { OrgConfig } from './schema-orgs.js'

// Phase E (post-launch hardening, issue 5). Production deployments
// run on pre-allocated parties (provisioned out-of-band via Canton's
// participant admin API) and need to seed one CSA per intended trader
// pair. Config-driven so deployment topology never requires source
// edits. Demo profile leaves both fields empty/absent and falls back
// to the canonical (partyA, partyB) pair created by Setup.Init.

export const csaPairSeedSchema = z.object({
  // Hints rather than org ids: the Daml init resolves parties via
  // `allocatePartyWithHint` (demo) or by user-id lookup (production),
  // both keyed by hint.
  traderAHint: z.string().min(1),
  traderBHint: z.string().min(1),
  isdaMasterAgreementRef: z.string().default(''),
  governingLaw: z.enum(['NewYork', 'English', 'Japanese']).default('NewYork'),
})

export const bootstrapSchema = z
  .object({
    csaPairs: z.array(csaPairSeedSchema).default([]),
  })
  .default({})

export type CsaPairSeed = z.infer<typeof csaPairSeedSchema>
export type BootstrapConfig = z.infer<typeof bootstrapSchema>

/**
 * Append "production deployments need to declare CSA pairs" issues to
 * the top-level superRefine context. Called only when profile=production.
 */
export function addBootstrapIssues(
  bootstrap: BootstrapConfig,
  orgs: readonly OrgConfig[],
  ctx: z.RefinementCtx,
): void {
  if (bootstrap.csaPairs.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['bootstrap', 'csaPairs'],
      message:
        'profile=production must declare at least one bootstrap.csaPairs entry; demo init only seeds the canonical PartyA/PartyB pair',
    })
    return
  }
  const traderHints = new Set(orgs.filter((o) => o.role === 'trader').map((o) => o.hint))
  bootstrap.csaPairs.forEach((pair, i) => {
    if (!traderHints.has(pair.traderAHint)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bootstrap', 'csaPairs', i, 'traderAHint'],
        message: `traderAHint "${pair.traderAHint}" does not match any orgs[].hint with role=trader`,
      })
    }
    if (!traderHints.has(pair.traderBHint)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bootstrap', 'csaPairs', i, 'traderBHint'],
        message: `traderBHint "${pair.traderBHint}" does not match any orgs[].hint with role=trader`,
      })
    }
    if (pair.traderAHint === pair.traderBHint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bootstrap', 'csaPairs', i],
        message: 'traderAHint and traderBHint must differ',
      })
    }
  })
}
