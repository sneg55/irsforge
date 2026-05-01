import { z } from 'zod'

// Client-side schema — mirrors shared-config schema without importing from it
// (shared-config is a server-only package)

// Mirrors `orgRoleSchema` in shared-config/src/schema-orgs.ts. Drives the
// CSA-counterparty dropdown filter (role==='trader') and any other UI that
// branches on platform role; cardinality (exactly one operator + regulator,
// ≥2 traders) is enforced server-side at config-load.
export const orgRoleSchema = z.enum(['trader', 'operator', 'regulator'])
export type OrgRole = z.infer<typeof orgRoleSchema>

const orgConfigSchema = z.object({
  id: z.string().min(1),
  party: z.string().min(1),
  displayName: z.string().min(1),
  hint: z.string().min(1),
  role: orgRoleSchema,
  ledgerUrl: z.string().min(1),
  streamUrl: z.string().min(1).optional(),
  subdomain: z.string().optional(),
})

const builtinAuthSchema = z.object({
  issuer: z.string().min(1),
  keyAlgorithm: z.string().optional(),
  tokenTtlSeconds: z.number().optional(),
  refreshTtlSeconds: z.number().optional(),
})

const oidcAuthSchema = z.object({
  authority: z.string().min(1),
  clientId: z.string().min(1),
  scopes: z.array(z.string()).optional(),
})

// Mirrors damlSchema in shared-config. unsafeJwtSecret is server-stripped in
// non-demo deployments — see app/src/app/api/config/route.ts — so it's optional
// here even though the server-side schema defaults it.
const damlConfigSchema = z.object({
  ledgerId: z.string().min(1),
  applicationId: z.string().min(1),
  unsafeJwtSecret: z.string().min(1).optional(),
})

// Currencies: mirrors the `currencies` list emitted by /api/config — only
// the client-safe fields (code/label/isDefault) are exposed here.
const currencySchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  isDefault: z.boolean().optional(),
})

// ISDA Master Agreements registered per counterparty pair. Mirrors the
// MasterAgreement type from shared-config but trimmed to client-safe fields.
// The proposal modal uses this to pin reference + governing-law for known
// pairs instead of asking for free-text on every CSA proposal.
const masterAgreementSchema = z.object({
  parties: z.tuple([z.string().min(1), z.string().min(1)]),
  reference: z.string().min(1),
  governingLaw: z.enum(['NewYork', 'English', 'Japanese']),
})

// Observables map: mirrors ObservablesConfig in features/workspace/types.ts.
// Every product carries `enabled: boolean` so the UI can filter disabled
// products out of the selector uniformly (Phase 0 Step 3). Kept permissive on
// `kind` so a new `kind` value added server-side doesn't brick the client
// until we bump the schema.
const observablesSchema = z.object({
  IRS: z.object({ rateIds: z.array(z.string()), kind: z.string(), enabled: z.boolean() }),
  OIS: z.object({ rateIds: z.array(z.string()), kind: z.string(), enabled: z.boolean() }),
  BASIS: z.object({ rateIds: z.array(z.string()), kind: z.string(), enabled: z.boolean() }),
  XCCY: z.object({ rateIds: z.array(z.string()), kind: z.string(), enabled: z.boolean() }),
  CDS: z.object({ rateIdPattern: z.string(), kind: z.string(), enabled: z.boolean() }),
  CCY: z.object({ rateIds: z.array(z.string()), kind: z.string(), enabled: z.boolean() }),
  FX: z.object({ rateIds: z.array(z.string()), kind: z.string(), enabled: z.boolean() }),
  ASSET: z.object({ rateIdPattern: z.string(), kind: z.string(), enabled: z.boolean() }),
  FpML: z.object({ rateIds: z.array(z.string()), kind: z.string(), enabled: z.boolean() }),
})

// Phase 6 Stage B: scheduler flags consumed by useFlags(). Cron strings
// are server-side / oracle-side and never reach the browser.
const schedulerClientSchema = z.object({
  enabled: z.boolean(),
  manualOverridesEnabled: z.boolean(),
})

// Operator policy: mirrors operatorSchema in shared-config.
// Only the policy map is surfaced to the client.
const operatorPolicyModeClientSchema = z.enum(['auto', 'manual'])

export type SwapFamily = 'IRS' | 'OIS' | 'BASIS' | 'XCCY' | 'CDS' | 'CCY' | 'FX' | 'ASSET' | 'FpML'
export type OperatorPolicyMode = z.infer<typeof operatorPolicyModeClientSchema>

const operatorClientSchema = z
  .object({
    policy: z
      .object({
        IRS: operatorPolicyModeClientSchema.optional(),
        OIS: operatorPolicyModeClientSchema.optional(),
        BASIS: operatorPolicyModeClientSchema.optional(),
        XCCY: operatorPolicyModeClientSchema.optional(),
        CDS: operatorPolicyModeClientSchema.optional(),
        CCY: operatorPolicyModeClientSchema.optional(),
        FX: operatorPolicyModeClientSchema.optional(),
        ASSET: operatorPolicyModeClientSchema.optional(),
        FpML: operatorPolicyModeClientSchema.optional(),
      })
      .optional(),
  })
  .optional()

// Mirrors platformSchema.demoReset in shared-config. The SPA reads this to
// render a countdown banner on shared-deployment demos; the host cron does
// the actual reset (see deploy/etc/cron.d/irsforge-reset). Optional because
// older configs that predate this block still parse cleanly.
const demoResetClientSchema = z
  .object({
    enabled: z.boolean(),
    intervalMinutes: z.number().int().positive(),
    message: z.string().optional(),
  })
  .optional()

export type DemoResetConfig = z.infer<typeof demoResetClientSchema>

// Mirrors platformSchema.ledgerUi in shared-config. Client-safe fields only —
// everything here already ships to the browser via /api/config.
const ledgerUiClientSchema = z
  .object({
    enabled: z.boolean(),
    bufferSize: z.number().int().positive(),
    templateFilter: z.object({
      allow: z.array(z.string()),
      deny: z.array(z.string()),
      systemPrefixes: z.array(z.string()),
    }),
    toasts: z.object({
      enabled: z.boolean(),
      maxVisible: z.number().int().nonnegative(),
      dismissAfterMs: z.number().int().positive(),
    }),
    rawPayload: z.object({
      enabled: z.boolean(),
    }),
  })
  .optional()

export const clientConfigSchema = z.object({
  // Mirrors top-level `profile` from shared-config. Surfaces to the browser
  // so demo-only fallbacks (e.g. useActiveOrgRole hint-scan) can self-gate
  // and fail loudly under profile=production.
  profile: z.enum(['demo', 'production']),
  topology: z.enum(['sandbox', 'network']),
  routing: z.enum(['path', 'subdomain']),
  // Mirrors `platform.authPublicUrl` on the server — the HTTP origin of
  // the IRSForge auth service. Distinct from `auth.builtin.issuer` (a JWT
  // `iss` claim) and `auth.oidc.authority` (the external IdP). Optional
  // because demo mode mints tokens in-browser and never hits /auth/*.
  authBaseUrl: z.string().url().optional(),
  auth: z.object({
    provider: z.enum(['demo', 'builtin', 'oidc']),
    builtin: builtinAuthSchema.optional(),
    oidc: oidcAuthSchema.optional(),
  }),
  daml: damlConfigSchema,
  orgs: z.array(orgConfigSchema).min(1),
  currencies: z.array(currencySchema).optional(),
  masterAgreements: z.array(masterAgreementSchema).default([]),
  observables: observablesSchema.optional(),
  scheduler: schedulerClientSchema.optional(),
  operator: operatorClientSchema,
  ledgerUi: ledgerUiClientSchema,
  demoReset: demoResetClientSchema,
})

export type OrgConfig = z.infer<typeof orgConfigSchema>
export type LedgerUiConfig = z.infer<typeof ledgerUiClientSchema>
export type ClientConfig = z.infer<typeof clientConfigSchema>

let cachedConfig: ClientConfig | null = null

export async function loadClientConfig(): Promise<ClientConfig> {
  if (cachedConfig !== null) {
    return cachedConfig
  }

  const response = await fetch('/api/config')
  if (!response.ok) {
    throw new Error(`Failed to load config: ${response.status} ${response.statusText}`)
  }

  const raw = (await response.json()) as unknown
  const parsed = clientConfigSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid config from server: ${parsed.error.message}`)
  }

  cachedConfig = parsed.data
  return cachedConfig
}

/** Override cached config — intended for testing only */
export function setClientConfig(config: ClientConfig): void {
  cachedConfig = config
}

/**
 * Base URL the SPA should use when calling the IRSForge auth service
 * (`/auth/authorize`, `/auth/handoff`, `/auth/refresh`, `/auth/login`,
 * `/auth/logout`). Sourced from `platform.authPublicUrl` on the server.
 *
 * Do NOT use `auth.builtin.issuer` (a JWT `iss` claim — often a stable
 * identifier, not necessarily the HTTP endpoint) or `auth.oidc.authority`
 * (the external OpenID Provider — Microsoft/Google/Okta/…, which does not
 * expose IRSForge's `/auth/*` routes). Both worked in the demo only because
 * `issuer` defaults to `authPublicUrl` when omitted; real OIDC deployments
 * 404 on every call.
 */
export function resolveAuthUrl(config: ClientConfig): string {
  if (config.auth.provider === 'demo') {
    throw new Error(`auth provider "${config.auth.provider}" has no browser URL`)
  }
  if (!config.authBaseUrl) {
    throw new Error('authBaseUrl missing — set platform.authPublicUrl on the server')
  }
  return config.authBaseUrl
}

/**
 * Resolve the WebSocket URL for Canton JSON API streaming for a given org.
 * Prefers the explicit `streamUrl` field. When unset, derives from
 * `ledgerUrl` by scheme-swap (http→ws, https→wss). Other schemes throw —
 * we do not silently default when the shape is ambiguous.
 */
export function resolveStreamUrl(org: OrgConfig): string {
  if (org.streamUrl) return org.streamUrl
  if (org.ledgerUrl.startsWith('https://')) return `wss://${org.ledgerUrl.slice('https://'.length)}`
  if (org.ledgerUrl.startsWith('http://')) return `ws://${org.ledgerUrl.slice('http://'.length)}`
  throw new Error(
    `resolveStreamUrl: cannot derive ws URL from ledgerUrl='${org.ledgerUrl}' — set org.streamUrl explicitly`,
  )
}
