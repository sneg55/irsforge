import { z } from 'zod'

export const builtinAuthSchema = z.object({
  issuer: z.string().url(),
  keyAlgorithm: z.string().default('RS256'),
  tokenTtlSeconds: z.number().int().positive().default(900),
  refreshTtlSeconds: z.number().int().positive().default(86400),
  port: z.number().int().positive().default(3002),
})

export const oidcAuthSchema = z.object({
  authority: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  scopes: z.array(z.string()).default(['openid', 'profile', 'email']),
})

// A service account is a non-human principal that can be granted ledger
// acting/reading rights via a long-lived JWT minted by the builtin issuer.
// The canonical use-case is the scheduler service, which needs to trigger
// lifecycle choices on behalf of swap counterparties without user interaction.
export const serviceAccountSchema = z.object({
  id: z.string().min(1),
  actAs: z.array(z.string().min(1)).min(1),
  readAs: z.array(z.string()).default([]),
})

// The auth block must reject provider/sub-block mismatches at config-load
// time, not at runtime. `builtin` is required whenever provider != demo
// because auth/src/index.ts mints the ledger JWT using builtin.issuer and
// the TTL fields — even in OIDC mode, where OIDC handles identity proof
// and builtin handles ledger token issuance. `oidc` is required only when
// provider == oidc.
export const authSchema = z
  .object({
    provider: z.enum(['demo', 'builtin', 'oidc']),
    builtin: builtinAuthSchema.optional(),
    oidc: oidcAuthSchema.optional(),
    serviceAccounts: z.array(serviceAccountSchema).default([]),
  })
  .superRefine((auth, ctx) => {
    if (auth.provider !== 'demo' && !auth.builtin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['builtin'],
        message: `auth.builtin is required when auth.provider="${auth.provider}" (used to mint ledger JWTs)`,
      })
    }
    if (auth.provider === 'oidc' && !auth.oidc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['oidc'],
        message: 'auth.oidc is required when auth.provider="oidc"',
      })
    }
    const ids = new Set<string>()
    auth.serviceAccounts.forEach((a, i) => {
      if (ids.has(a.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['serviceAccounts', i, 'id'],
          message: `duplicate serviceAccount id: ${a.id}`,
        })
      }
      ids.add(a.id)
    })
  })
