import type { z } from 'zod'
import type { BootstrapConfig } from './schema-bootstrap.js'
import { addBootstrapIssues } from './schema-bootstrap.js'
import type { OrgConfig } from './schema-orgs.js'
import { addOrgAllowlistIssues, addOrgRoleIssues } from './schema-orgs.js'
import { addServiceAccountIssues } from './schema-service-accounts.js'

// Cross-subtree validation that doesn't fit on any single nested schema.
// Lifted out of schema.ts to keep that file under the 300-line cap.

interface RefinementInput {
  profile: 'demo' | 'production'
  routing: 'path' | 'subdomain'
  auth: { provider: 'demo' | 'builtin' | 'oidc' }
  platform: { frontendUrlTemplate?: string }
  currencies: Array<{ code: string; isDefault: boolean }>
  orgs: OrgConfig[]
  demo?: Record<string, unknown>
  bootstrap: BootstrapConfig
}

export function applyTopLevelRefinements(
  config: RefinementInput,
  ctx: z.RefinementCtx,
  serviceAccountInput: Parameters<typeof addServiceAccountIssues>[0],
): void {
  applyRoutingRules(config, ctx)
  applyCurrencyRules(config.currencies, ctx)
  addOrgRoleIssues(config.orgs, ctx)
  if (config.profile === 'production' && config.auth.provider === 'oidc') {
    addOrgAllowlistIssues(config.orgs, ctx)
  }
  applyProductionDemoSubtreeBan(config, ctx)
  if (config.profile === 'production') {
    addBootstrapIssues(config.bootstrap, config.orgs, ctx)
  }
  addServiceAccountIssues(serviceAccountInput, ctx)
}

function applyRoutingRules(config: RefinementInput, ctx: z.RefinementCtx): void {
  if (config.routing !== 'subdomain') return
  config.orgs.forEach((org, i) => {
    if (org.subdomain === undefined || org.subdomain === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['orgs', i, 'subdomain'],
        message: "subdomain is required for every org when routing is 'subdomain'",
      })
    }
  })
  if (config.platform.frontendUrlTemplate === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['platform', 'frontendUrlTemplate'],
      message: "frontendUrlTemplate is required when routing is 'subdomain'",
    })
  } else if (!config.platform.frontendUrlTemplate.includes('{subdomain}')) {
    ctx.addIssue({
      code: 'custom',
      path: ['platform', 'frontendUrlTemplate'],
      message: "frontendUrlTemplate must contain the literal token '{subdomain}'",
    })
  }
}

function applyCurrencyRules(currencies: RefinementInput['currencies'], ctx: z.RefinementCtx): void {
  const defaults = currencies.filter((c) => c.isDefault)
  if (defaults.length !== 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['currencies'],
      message: `exactly one currency must have isDefault: true (got ${defaults.length})`,
    })
  }
  const codes = new Set<string>()
  currencies.forEach((c, i) => {
    if (codes.has(c.code)) {
      ctx.addIssue({
        code: 'custom',
        path: ['currencies', i, 'code'],
        message: `duplicate currency code: ${c.code}`,
      })
    }
    codes.add(c.code)
  })
}

function applyProductionDemoSubtreeBan(config: RefinementInput, ctx: z.RefinementCtx): void {
  // A production deployment must not carry a populated `demo:` subtree.
  // Empty-object is allowed so operators can flip `profile` back and forth
  // without deleting the block; anything populated is a hard error.
  if (config.profile !== 'production' || !config.demo) return
  const populated = Object.keys(config.demo).some(
    (k) => config.demo?.[k as keyof typeof config.demo] !== undefined,
  )
  if (populated) {
    ctx.addIssue({
      code: 'custom',
      path: ['demo'],
      message: 'profile=production must not carry a populated `demo:` subtree',
    })
  }
}
