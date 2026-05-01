import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { HandoffStore } from './auth/handoff-store.js'
import { OidcStateStore } from './auth/state-store.js'
import { getConfig } from './config.js'
import { loadOrGenerateKeys } from './keys/manager.js'
import { BuiltinProvider } from './providers/builtin.js'
import type { AuthProvider } from './providers/interface.js'
import { OidcProvider } from './providers/oidc.js'
import { handleCallback } from './routes/callback.js'
import { handleHandoff } from './routes/handoff.js'
import { handleJwks } from './routes/jwks.js'
import { handleLogin } from './routes/login.js'
import { handleLogout } from './routes/logout.js'
import { handleOAuthToken } from './routes/oauth-token.js'
import { handleRefresh } from './routes/refresh.js'
import { makeCorsHandler, readBody, send, sendError } from './routes/shared.js'
import { ServiceAccountsRegistry } from './service-accounts/registry.js'
import { RefreshTokenStore } from './tokens/refresh.js'

async function main(): Promise<void> {
  const config = getConfig()

  if (config.auth.provider === 'demo') {
    console.log('[auth] provider=demo — auth service not needed, exiting')
    process.exit(0)
  }

  const builtinCfg = config.auth.builtin
  if (!builtinCfg) {
    console.error('[auth] auth.builtin section required when provider != demo')
    process.exit(1)
  }

  const port = Number(process.env['AUTH_PORT'] ?? builtinCfg.port)
  const keys = await loadOrGenerateKeys(resolve(process.cwd(), 'keys'))
  const tokenStore = new RefreshTokenStore(builtinCfg.refreshTtlSeconds)
  // CSRF state for OIDC redirect flow. Single-process only; multi-instance
  // deployments must back this with a shared store (e.g. Redis).
  const stateStore = new OidcStateStore()
  // Bridge fresh access tokens from /auth/callback (server) to the SPA
  // without putting the JWT in the redirect URL. Single-process only; ditto.
  const handoffStore = new HandoffStore()

  const { platform, routing, orgs } = config

  const allowedOrigins: string[] = (() => {
    if (routing === 'subdomain' && platform.frontendUrlTemplate !== undefined) {
      const template = platform.frontendUrlTemplate
      const perOrg = orgs
        .filter((o): o is typeof o & { subdomain: string } => o.subdomain !== undefined)
        .map((o) => template.replace('{subdomain}', o.subdomain))
      // Include frontendUrl for non-org-scoped pages (e.g. org picker).
      return [platform.frontendUrl, ...perOrg]
    }
    return [platform.frontendUrl]
  })()

  const frontendUrlFor = (orgId: string): string => {
    if (routing === 'subdomain' && platform.frontendUrlTemplate !== undefined) {
      const org = orgs.find((o) => o.id === orgId)
      if (org?.subdomain !== undefined) {
        return platform.frontendUrlTemplate.replace('{subdomain}', org.subdomain)
      }
    }
    return platform.frontendUrl
  }

  const errorRedirectUrl = platform.frontendUrl

  let provider: AuthProvider

  if (config.auth.provider === 'builtin') {
    const usersFilePath = resolve(process.cwd(), 'users.yaml')
    provider = await BuiltinProvider.fromFile(usersFilePath, config.orgs)
  } else {
    // oidc
    const oidcCfg = config.auth.oidc
    if (!oidcCfg) {
      console.error('[auth] OIDC config missing — check irsforge.yaml')
      process.exit(1)
    }
    provider = new OidcProvider(
      {
        authority: oidcCfg.authority,
        clientId: oidcCfg.clientId,
        clientSecret: oidcCfg.clientSecret,
        scopes: oidcCfg.scopes,
        callbackUrl: `${platform.authPublicUrl}/auth/callback`,
      },
      config.orgs,
    )
  }

  const serviceAccountsPath = resolve(process.cwd(), 'service-accounts.yaml')
  const serviceAccounts = config.auth.serviceAccounts
  let serviceAccountsRegistry: ServiceAccountsRegistry | null = null
  if (serviceAccounts.length > 0) {
    try {
      serviceAccountsRegistry = ServiceAccountsRegistry.fromFile(serviceAccountsPath)
    } catch (err) {
      console.error(
        `[auth] Failed to load service-accounts.yaml at ${serviceAccountsPath}:`,
        err instanceof Error ? err.message : err,
      )
      process.exit(1)
    }
    for (const acct of serviceAccounts) {
      if (!serviceAccountsRegistry.has(acct.id)) {
        console.error(
          `[auth] irsforge.yaml declares auth.serviceAccounts[id="${acct.id}"] but service-accounts.yaml has no matching entry`,
        )
        process.exit(1)
      }
    }
  }

  // Issuer resolution: builtin.issuer is loader-defaulted to authPublicUrl
  // when omitted; for oidc / other providers fall back directly.
  const issuer = builtinCfg.issuer
  const tokenTtlSeconds = builtinCfg.tokenTtlSeconds
  const refreshTtlSeconds = builtinCfg.refreshTtlSeconds
  const { ledgerId, applicationId } = config.daml

  const handleCors = makeCorsHandler(allowedOrigins)

  // eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- linear HTTP route dispatcher; each branch is a distinct endpoint and splitting into a map of handlers loses the handoff-specific context captured in this closure
  const server = createServer((req: IncomingMessage, res: ServerResponse): void => {
    if (handleCors(req, res)) return

    const url = req.url?.split('?')[0] ?? ''
    const method = req.method ?? 'GET'

    if (url === '/.well-known/jwks.json' && method === 'GET') {
      void handleJwks(req, res, keys)
      return
    }

    if (url === '/auth/health' && method === 'GET') {
      send(res, 200, { status: 'ok', provider: config.auth.provider })
      return
    }

    if (url === '/auth/login' && method === 'POST') {
      void handleLogin(req, res, {
        provider,
        keys,
        tokenStore,
        issuer,
        tokenTtlSeconds,
        refreshTtlSeconds,
        ledgerId,
        applicationId,
      })
      return
    }

    if (url === '/auth/authorize' && method === 'GET') {
      if (!provider.getAuthorizationUrl) {
        sendError(res, 400, 'Authorization redirect not supported by this provider')
        return
      }
      const reqUrl = new URL(req.url ?? '/', `http://${req.headers.host}`)
      const orgId = reqUrl.searchParams.get('orgId') ?? ''
      const state = crypto.randomUUID()
      const nonce = crypto.randomUUID()
      stateStore.put(state, { orgId, nonce })
      const redirectUrl = provider.getAuthorizationUrl(state, nonce)
      res.writeHead(302, { Location: redirectUrl })
      res.end()
      return
    }

    if (url === '/auth/callback' && method === 'GET') {
      void handleCallback(req, res, {
        provider,
        keys,
        tokenStore,
        stateStore,
        handoffStore,
        issuer,
        tokenTtlSeconds,
        refreshTtlSeconds,
        ledgerId,
        applicationId,
        frontendUrlFor,
        errorRedirectUrl,
      })
      return
    }

    if (url === '/auth/handoff' && method === 'POST') {
      void handleHandoff(req, res, { handoffStore })
      return
    }

    if (url === '/auth/refresh' && method === 'POST') {
      void handleRefresh(req, res, {
        keys,
        tokenStore,
        orgs: config.orgs,
        issuer,
        tokenTtlSeconds,
        refreshTtlSeconds,
        ledgerId,
        applicationId,
      })
      return
    }

    if (url === '/auth/oauth/token' && method === 'POST') {
      if (!serviceAccountsRegistry) {
        sendError(res, 404, 'Not found')
        return
      }
      const registry = serviceAccountsRegistry
      void (async () => {
        const rawBody = await readBody(req)
        const result = await handleOAuthToken(
          { contentType: req.headers['content-type'], rawBody },
          {
            registry,
            keys,
            issuer,
            tokenTtlSeconds,
            ledgerId,
            applicationId,
            accounts: serviceAccounts,
          },
        )
        send(res, result.status, result.body)
      })().catch((err: unknown) => {
        sendError(res, 500, err instanceof Error ? err.message : 'Internal error')
      })
      return
    }

    if (url === '/auth/logout' && method === 'POST') {
      handleLogout(req, res, { tokenStore })
      return
    }

    sendError(res, 404, 'Not found')
  })

  server.listen(port, () => {
    console.log(`[auth] Listening on port ${port} (public URL: ${platform.authPublicUrl})`)
    console.log(`[auth] Provider: ${config.auth.provider}`)
    console.log(`[auth] Issuer: ${issuer}`)
    console.log(`[auth] Token TTL: ${tokenTtlSeconds}s`)
    console.log(`[auth] Refresh TTL: ${refreshTtlSeconds}s`)
    console.log(`[auth] JWKS: ${platform.authPublicUrl}/.well-known/jwks.json`)
    console.log(`[auth] Allowed origins: ${allowedOrigins.join(', ')}`)
  })
}

main().catch((err: unknown) => {
  console.error('[auth] Fatal error:', err)
  process.exit(1)
})
