import { z } from 'zod'

// Cross-subtree refinement: non-demo deployments require specific service
// account entries. The oracle's mark loop needs a signed operator-authored JWT
// (mark-publisher); the scheduler additionally needs its own JWT when enabled.
// The resolver refuses to boot without these entries.

interface ServiceAccountsRefinementInput {
  auth: {
    provider: string
    serviceAccounts: Array<{ id: string }>
  }
  scheduler: { enabled: boolean }
}

export function addServiceAccountIssues(
  config: ServiceAccountsRefinementInput,
  ctx: z.RefinementCtx,
): void {
  if (config.auth.provider === 'demo') return

  const accountIds = new Set(config.auth.serviceAccounts.map((a) => a.id))

  if (!accountIds.has('mark-publisher')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['auth', 'serviceAccounts'],
      message:
        'auth.serviceAccounts must include an entry with id="mark-publisher" when auth.provider != "demo"',
    })
  }

  if (config.scheduler.enabled && !accountIds.has('scheduler')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['auth', 'serviceAccounts'],
      message:
        'auth.serviceAccounts must include an entry with id="scheduler" when auth.provider != "demo" and scheduler.enabled',
    })
  }
}
