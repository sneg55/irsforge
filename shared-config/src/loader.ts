import { existsSync, readFileSync, statSync } from 'node:fs'
import path, { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { configSchema } from './schema.js'
import type { Config } from './types.js'

// Detect dist staleness at import time. When the compiled dist is older
// than any TS source it was built from, `loadConfig` would otherwise
// silently drop fields added in the source — this is exactly the bug
// the Phase 3 Stage B smoke hit (schema had curves/floatingRateIndices,
// dist predated the change, downstream seeds no-opped with no log).
//
// Runs once per process, only when both paths exist on disk. In
// published-package contexts the src/ dir is absent so the check skips.
let stalenessChecked = false
function checkDistFreshness(): void {
  if (stalenessChecked) return
  stalenessChecked = true
  try {
    const distLoader = fileURLToPath(import.meta.url)
    // Running directly from src/ under tsx (e.g. the package's own test
    // harness) — the check is meant for consumers loading from dist/.
    if (distLoader.includes(`${path.sep}src${path.sep}`)) return
    const pkgRoot = resolve(dirname(distLoader), '..')
    const srcLoader = resolve(pkgRoot, 'src/loader.ts')
    const srcSchema = resolve(pkgRoot, 'src/schema.ts')
    if (!existsSync(srcLoader) || !existsSync(srcSchema)) return
    const distMtime = statSync(distLoader).mtimeMs
    const srcMax = Math.max(statSync(srcLoader).mtimeMs, statSync(srcSchema).mtimeMs)
    if (srcMax > distMtime) {
      const msg =
        `shared-config/dist is stale (src newer by ${Math.round((srcMax - distMtime) / 1000)}s). ` +
        `Run \`cd shared-config && npm run build\` or \`make shared-config-build\`. ` +
        `Running against stale dist will silently drop fields added in src/.`
      throw new Error(msg)
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('shared-config/dist is stale')) {
      throw err
    }
    // Any other fs/resolution error → don't block the import; this guard
    // is a dev-time convenience, not a correctness requirement.
  }
}

function applyEnvOverrides(raw: Record<string, unknown>): Record<string, unknown> {
  const result = structuredClone(raw)

  if (process.env['IRSFORGE_TOPOLOGY']) {
    result['topology'] = process.env['IRSFORGE_TOPOLOGY']
  }

  if (process.env['IRSFORGE_ROUTING']) {
    result['routing'] = process.env['IRSFORGE_ROUTING']
  }

  // Auth overrides
  const auth = (result['auth'] ?? {}) as Record<string, unknown>

  if (process.env['IRSFORGE_AUTH_PROVIDER']) {
    auth['provider'] = process.env['IRSFORGE_AUTH_PROVIDER']
  }

  // Builtin auth overrides
  if (process.env['IRSFORGE_BUILTIN_ISSUER']) {
    const builtin = (auth['builtin'] ?? {}) as Record<string, unknown>
    builtin['issuer'] = process.env['IRSFORGE_BUILTIN_ISSUER']
    auth['builtin'] = builtin
  }

  // OIDC auth overrides
  const hasOidc =
    process.env['IRSFORGE_OIDC_AUTHORITY'] ||
    process.env['IRSFORGE_OIDC_CLIENT_ID'] ||
    process.env['IRSFORGE_OIDC_CLIENT_SECRET']

  if (hasOidc) {
    const oidc = (auth['oidc'] ?? {}) as Record<string, unknown>
    if (process.env['IRSFORGE_OIDC_AUTHORITY']) {
      oidc['authority'] = process.env['IRSFORGE_OIDC_AUTHORITY']
    }
    if (process.env['IRSFORGE_OIDC_CLIENT_ID']) {
      oidc['clientId'] = process.env['IRSFORGE_OIDC_CLIENT_ID']
    }
    if (process.env['IRSFORGE_OIDC_CLIENT_SECRET']) {
      oidc['clientSecret'] = process.env['IRSFORGE_OIDC_CLIENT_SECRET']
    }
    auth['oidc'] = oidc
  }

  result['auth'] = auth

  // Oracle override
  if (process.env['IRSFORGE_ORACLE_URL']) {
    const oracle = (result['oracle'] ?? {}) as Record<string, unknown>
    oracle['url'] = process.env['IRSFORGE_ORACLE_URL']
    result['oracle'] = oracle
  }

  // Platform overrides
  const platform = (result['platform'] ?? {}) as Record<string, unknown>
  let platformTouched = Object.keys(platform).length > 0
  if (process.env['IRSFORGE_AUTH_PUBLIC_URL']) {
    platform['authPublicUrl'] = process.env['IRSFORGE_AUTH_PUBLIC_URL']
    platformTouched = true
  }
  if (process.env['IRSFORGE_FRONTEND_URL']) {
    platform['frontendUrl'] = process.env['IRSFORGE_FRONTEND_URL']
    platformTouched = true
  }
  if (process.env['IRSFORGE_FRONTEND_URL_TEMPLATE']) {
    platform['frontendUrlTemplate'] = process.env['IRSFORGE_FRONTEND_URL_TEMPLATE']
    platformTouched = true
  }
  if (platformTouched) {
    result['platform'] = platform
  }

  // Convenience default: if builtin auth exists without an issuer, use
  // platform.authPublicUrl so simple deployments set one URL, not two.
  const authBlock = (result['auth'] ?? {}) as Record<string, unknown>
  const builtin = authBlock['builtin'] as Record<string, unknown> | undefined
  const platformBlock = result['platform'] as Record<string, unknown> | undefined
  if (builtin && !builtin['issuer'] && platformBlock?.['authPublicUrl']) {
    builtin['issuer'] = platformBlock['authPublicUrl']
    authBlock['builtin'] = builtin
    result['auth'] = authBlock
  }

  // Daml claim overrides
  const hasDamlOverride =
    process.env['IRSFORGE_DAML_LEDGER_ID'] ||
    process.env['IRSFORGE_DAML_APPLICATION_ID'] ||
    process.env['IRSFORGE_DAML_UNSAFE_JWT_SECRET']

  if (hasDamlOverride) {
    const daml = (result['daml'] ?? {}) as Record<string, unknown>
    if (process.env['IRSFORGE_DAML_LEDGER_ID']) {
      daml['ledgerId'] = process.env['IRSFORGE_DAML_LEDGER_ID']
    }
    if (process.env['IRSFORGE_DAML_APPLICATION_ID']) {
      daml['applicationId'] = process.env['IRSFORGE_DAML_APPLICATION_ID']
    }
    if (process.env['IRSFORGE_DAML_UNSAFE_JWT_SECRET']) {
      daml['unsafeJwtSecret'] = process.env['IRSFORGE_DAML_UNSAFE_JWT_SECRET']
    }
    result['daml'] = daml
  }

  // Ledger upstream-timeout override
  if (process.env['IRSFORGE_LEDGER_UPSTREAM_TIMEOUT_MS']) {
    const ledger = (result['ledger'] ?? {}) as Record<string, unknown>
    const n = Number(process.env['IRSFORGE_LEDGER_UPSTREAM_TIMEOUT_MS'])
    ledger['upstreamTimeoutMs'] = Number.isFinite(n)
      ? n
      : process.env['IRSFORGE_LEDGER_UPSTREAM_TIMEOUT_MS']
    result['ledger'] = ledger
  }

  // Ledger URL override (sandbox topology only)
  const ledgerOverride = process.env['IRSFORGE_LEDGER_URL'] ?? process.env['LEDGER_URL']
  if (ledgerOverride && result['topology'] === 'sandbox') {
    const orgs = (result['orgs'] ?? []) as Record<string, unknown>[]
    for (const org of orgs) {
      org['ledgerUrl'] = ledgerOverride
    }
    result['orgs'] = orgs
  }

  return result
}

export function loadConfig(filePath: string): Config {
  checkDistFreshness()
  if (!existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`)
  }

  const raw = readFileSync(filePath, 'utf8')
  const parsed = parse(raw) as Record<string, unknown>
  const withOverrides = applyEnvOverrides(parsed)

  const result = configSchema.safeParse(withOverrides)
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid config: ${message}`)
  }

  return result.data
}
