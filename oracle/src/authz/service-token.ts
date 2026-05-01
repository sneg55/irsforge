import type { Config } from 'irsforge-shared-config'
import { ENV } from '../shared/env.js'
import { mintDemoSchedulerToken } from './mint-demo-scheduler-token.js'
import { mintDemoOperatorToken } from './mint-demo-token.js'

// Long-running oracle services whose ledger identities are registered in
// `auth.serviceAccounts`. Keep this union in sync with that config list.
export type ServiceAccountId = 'scheduler' | 'mark-publisher'

export interface ServiceTokenHandle {
  getToken: () => Promise<string>
  // Clears the refresh timer when the service is shutting down. No-op for
  // env-override and demo-mint handles (no timer to cancel).
  stop: () => void
}

function readEnvOverride(accountId: ServiceAccountId): string | undefined {
  const primary = ENV.SERVICE_TOKEN(accountId)
  if (primary !== '') return primary
  // OPERATOR_TOKEN is the legacy alias for the mark-publisher service token.
  // Keeps pre-service-account deployments working without env-var churn.
  if (accountId === 'mark-publisher') {
    const legacy = ENV.OPERATOR_TOKEN()
    if (legacy !== '') return legacy
  }
  return undefined
}

function constantHandle(token: string): ServiceTokenHandle {
  return {
    getToken: () => Promise.resolve(token),
    stop: () => {
      /* no timer to cancel */
    },
  }
}

async function mintDemo(accountId: ServiceAccountId, config: Config): Promise<ServiceTokenHandle> {
  const token =
    accountId === 'scheduler'
      ? await mintDemoSchedulerToken(config)
      : await mintDemoOperatorToken(config)
  if (token == null || token === '') {
    throw new Error(
      `resolveServiceToken: demo mint returned null for "${accountId}" — Canton unreachable or party not allocated`,
    )
  }
  return constantHandle(token)
}

interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface OAuthState {
  accountId: ServiceAccountId
  endpoint: string
  clientId: string
  clientSecret: string
  token: string
  timer: ReturnType<typeof setTimeout> | null
}

async function postClientCredentials(
  endpoint: string,
  clientId: string,
  clientSecret: string,
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  }).toString()
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OAuth2 token endpoint ${endpoint} returned ${res.status}: ${text}`)
  }
  return (await res.json()) as OAuthTokenResponse
}

function scheduleRefresh(state: OAuthState, delayMs: number, onFatal: (err: Error) => void): void {
  state.timer = setTimeout(() => {
    void (async () => {
      try {
        const next = await postClientCredentials(state.endpoint, state.clientId, state.clientSecret)
        state.token = next.access_token
        scheduleRefresh(state, next.expires_in * 1000 * 0.8, onFatal)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/401/.test(msg) || /invalid_client/.test(msg)) {
          onFatal(err instanceof Error ? err : new Error(msg))
          return
        }
        // Transient failure: schedule one last attempt at ~0.9 × TTL total
        // (delayMs was 0.8 × TTL; * 0.125 adds another 0.1 × TTL).
        scheduleRefresh(state, delayMs * 0.125, onFatal)
      }
    })()
  }, delayMs)
}

async function acquireServiceAccountToken(
  accountId: ServiceAccountId,
  config: Config,
): Promise<ServiceTokenHandle> {
  const clientSecret = ENV.SERVICE_CLIENT_SECRET(accountId)
  if (clientSecret === '') {
    const key = `SERVICE_CLIENT_SECRET_${accountId.toUpperCase().replace(/-/g, '_')}`
    throw new Error(`resolveServiceToken: ${key} env var required for non-demo auth.provider`)
  }
  const endpoint = `${config.platform.authPublicUrl}/auth/oauth/token`
  const first = await postClientCredentials(endpoint, accountId, clientSecret)

  const state: OAuthState = {
    accountId,
    endpoint,
    clientId: accountId,
    clientSecret,
    token: first.access_token,
    timer: null,
  }

  let fatal: Error | null = null
  const onFatal = (err: Error): void => {
    fatal = err
  }
  scheduleRefresh(state, first.expires_in * 1000 * 0.8, onFatal)

  return {
    getToken: () => {
      if (fatal) return Promise.reject(fatal)
      return Promise.resolve(state.token)
    },
    stop: () => {
      if (state.timer) clearTimeout(state.timer)
      state.timer = null
    },
  }
}

export async function resolveServiceToken(
  accountId: ServiceAccountId,
  config: Config,
): Promise<ServiceTokenHandle> {
  const override = readEnvOverride(accountId)
  if (override !== undefined) return constantHandle(override)
  if (config.auth.provider === 'demo') return await mintDemo(accountId, config)
  return await acquireServiceAccountToken(accountId, config)
}
