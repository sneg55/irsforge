import { NextResponse } from 'next/server'
import { loadResolvedConfig } from '@/shared/config/server'

// `next build` statically renders route handlers with no dynamic markers,
// baking the YAML state at build time into the produced bundle. The
// shared-demo Docker image edits irsforge.yaml on the host AFTER the
// image is built (e.g. flipping demoReset, swapping streamUrl for the
// public host), so the static cache must be opted out — every request
// must re-read the YAML.
export const dynamic = 'force-dynamic'

export function GET(): Promise<NextResponse> {
  try {
    const config = loadResolvedConfig()

    // Build client-safe copy: strip secrets and server-only fields.
    // unsafeJwtSecret is the Canton sandbox demo HMAC key — exposed to the
    // browser ONLY when provider==="demo" so it never ships in production
    // bundles deployed against builtin/oidc auth.
    const safe: Record<string, unknown> = {
      profile: config.profile,
      topology: config.topology,
      routing: config.routing,
      // Base URL of the IRSForge auth service (what serves /auth/authorize,
      // /auth/handoff, /auth/refresh, /auth/login, /auth/logout). The SPA
      // must call *this* — not `auth.builtin.issuer` (a JWT `iss` claim) or
      // `auth.oidc.authority` (the external IdP), both of which differ from
      // the auth service in any non-trivial deployment.
      authBaseUrl: config.platform.authPublicUrl,
      orgs: config.orgs,
      currencies: config.currencies.map((c) => ({
        code: c.code,
        label: c.label,
        isDefault: c.isDefault,
      })),
      // ISDA Master Agreements registered per counterparty pair. Pure
      // metadata, no secrets — pass through verbatim so the New CSA Proposal
      // modal can pin reference + governing-law for known pairs.
      masterAgreements: config.masterAgreements,
      // Rate-id metadata (rateIds / rateIdPattern / kind) stays colocated with
      // the server route for now — it is tightly coupled to the on-chain
      // lifecycle rule shape. Per-product `enabled` flags come from YAML
      // (`observables.*.enabled`) so a deployment can toggle a product without
      // touching source.
      observables: {
        IRS: {
          rateIds: ['USD-SOFR'],
          kind: 'periodic-fixing',
          enabled: config.observables.IRS.enabled,
        },
        // OIS uses the same USD-SOFR index as IRS; rate-id content is identical
        // but the `enabled` flag is independent so operators can gate OIS
        // without disabling IRS.
        OIS: {
          rateIds: ['USD-SOFR'],
          kind: 'periodic-fixing',
          enabled: config.observables.OIS.enabled,
        },
        BASIS: {
          rateIds: ['USD-SOFR'],
          kind: 'periodic-fixing',
          enabled: config.observables.BASIS.enabled,
        },
        XCCY: {
          rateIds: ['USD-SOFR'],
          kind: 'periodic-fixing',
          enabled: config.observables.XCCY.enabled,
        },
        CDS: {
          rateIdPattern: 'CDS/{refName}/{DefaultProb|Recovery}',
          kind: 'credit-event',
          enabled: config.observables.CDS.enabled,
        },
        CCY: { rateIds: [], kind: 'none', enabled: config.observables.CCY.enabled },
        FX: { rateIds: [], kind: 'none', enabled: config.observables.FX.enabled },
        ASSET: {
          rateIdPattern: 'ASSET/{assetId}',
          kind: 'price',
          enabled: config.observables.ASSET.enabled,
        },
        FpML: { rateIds: [], kind: 'embedded', enabled: config.observables.FpML.enabled },
      },
      auth: {
        provider: config.auth.provider,
        builtin: config.auth.builtin
          ? {
              issuer: config.auth.builtin.issuer,
              keyAlgorithm: config.auth.builtin.keyAlgorithm,
              tokenTtlSeconds: config.auth.builtin.tokenTtlSeconds,
              refreshTtlSeconds: config.auth.builtin.refreshTtlSeconds,
            }
          : undefined,
        oidc: config.auth.oidc
          ? {
              authority: config.auth.oidc.authority,
              clientId: config.auth.oidc.clientId,
              scopes: config.auth.oidc.scopes,
            }
          : undefined,
      },
      daml: {
        ledgerId: config.daml.ledgerId,
        applicationId: config.daml.applicationId,
        ...(config.auth.provider === 'demo'
          ? { unsafeJwtSecret: config.daml.unsafeJwtSecret }
          : {}),
      },
      // Phase 6 Stage B: scheduler enablement + manual-button gating.
      // The cron strings are oracle-side concerns and intentionally
      // omitted — the browser only needs the boolean flags.
      scheduler: {
        enabled: config.scheduler.enabled,
        manualOverridesEnabled: config.scheduler.manualOverridesEnabled,
      },
      ledgerUi: {
        enabled: config.platform.ledgerUi.enabled,
        bufferSize: config.platform.ledgerUi.bufferSize,
        templateFilter: {
          allow: config.platform.ledgerUi.templateFilter.allow,
          deny: config.platform.ledgerUi.templateFilter.deny,
          systemPrefixes: config.platform.ledgerUi.templateFilter.systemPrefixes,
        },
        toasts: {
          enabled: config.platform.ledgerUi.toasts.enabled,
          maxVisible: config.platform.ledgerUi.toasts.maxVisible,
          dismissAfterMs: config.platform.ledgerUi.toasts.dismissAfterMs,
        },
        rawPayload: {
          enabled: config.platform.ledgerUi.rawPayload.enabled,
        },
      },
      demoReset: {
        enabled: config.platform.demoReset.enabled,
        intervalMinutes: config.platform.demoReset.intervalMinutes,
        ...(config.platform.demoReset.message !== undefined
          ? { message: config.platform.demoReset.message }
          : {}),
      },
      // oracle intentionally omitted — browser uses /api/oracle proxy
    }

    return Promise.resolve(NextResponse.json(safe))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Promise.resolve(
      NextResponse.json({ error: `Failed to load config: ${message}` }, { status: 500 }),
    )
  }
}
