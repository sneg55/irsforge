import { z } from 'zod'

// Drives role-aware UI filters (e.g. CSA dialog hides system principals)
// and lets schema validation enforce platform cardinality (exactly one
// operator, at least one regulator, and at least two traders). Scheduler is
// a service account, not an org — not represented here.
export const orgRoleSchema = z.enum(['trader', 'operator', 'regulator'])

export const orgSchema = z.object({
  id: z.string().min(1),
  party: z.string().min(1),
  displayName: z.string().min(1),
  hint: z.string().min(1),
  // Required: encodes platform-role intent in YAML so UI filters and
  // validation can reason in terms of role rather than string-matching
  // hints. Required (not optional with default) — silent default is a
  // footgun (a "Custodian" org would default to trader and slip into the
  // CSA counterparty dropdown).
  role: orgRoleSchema,
  ledgerUrl: z.string().url(),
  // Optional explicit WebSocket URL for /v1/stream/query. When unset, the
  // client derives one by swapping http→ws / https→wss on `ledgerUrl`.
  // Override when the JSON API's WS endpoint lives on a different host/port
  // (e.g. a dedicated stream gateway in a production topology).
  streamUrl: z
    .string()
    .url()
    .regex(/^wss?:\/\//, {
      message: 'streamUrl must be a ws:// or wss:// URL',
    })
    .optional(),
  subdomain: z.string().optional(),
})

export type OrgConfig = z.infer<typeof orgSchema>

/**
 * Append role-cardinality issues to the top-level superRefine context.
 *
 * Exactly one operator, at least one regulator, and at least two trader orgs
 * (no CSA is possible with fewer counterparties). Kept here so adding a new
 * role enum value only requires touching one file.
 */
export function addOrgRoleIssues(orgs: readonly OrgConfig[], ctx: z.RefinementCtx): void {
  const operatorCount = orgs.filter((o) => o.role === 'operator').length
  if (operatorCount !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['orgs'],
      message: `exactly one org must have role: operator (got ${operatorCount})`,
    })
  }
  // Multi-regulator deployments are now supported: every contract observes
  // the full list (Daml `regulators : [Party]`). The minimum is one — a
  // deployment with zero regulator orgs has nobody on the regulatory side
  // and the schema would let the platform start in a broken topology.
  const regulatorCount = orgs.filter((o) => o.role === 'regulator').length
  if (regulatorCount < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['orgs'],
      message: `at least one org must have role: regulator (got ${regulatorCount})`,
    })
  }
  const traderCount = orgs.filter((o) => o.role === 'trader').length
  if (traderCount < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['orgs'],
      message: `at least two orgs must have role: trader (got ${traderCount})`,
    })
  }
}
