// Sandbox-rotation token re-mint helpers. Pulled out of `auth-context.tsx`
// so the provider stays under the 300-line guardrail and the rotation
// logic is unit-testable without React.

import type { ClientConfig } from '../config/client'
import { clearPartyCacheForRotation, demoActAsReadAs, generatePartyToken } from '../ledger/parties'
import type { AuthState, LoginResponse } from './auth-types'

const DEMO_TOKEN_LIFETIME_SEC = 24 * 60 * 60

export type RemintRequest = {
  readonly config: ClientConfig
  readonly current: AuthState
  readonly authUrl: string
}

export type RemintOutcome =
  | { readonly kind: 'demo'; readonly state: AuthState }
  | { readonly kind: 'refresh'; readonly state: AuthState; readonly expiresIn: number }

// Re-mint a demo HMAC token. Drops the in-memory party-id cache so
// `generatePartyToken` re-runs the /v1/parties bootstrap and picks up
// the freshly allocated `Hint::1220<fingerprint>` IDs from the new
// Canton boot. Returns the AuthState the caller should setState() into.
export async function remintDemoToken(req: RemintRequest): Promise<AuthState | null> {
  const { config, current } = req
  clearPartyCacheForRotation()
  const org = config.orgs.find((o) => o.id === current.orgId)
  if (!org) return null
  const { actAs, readAs } = demoActAsReadAs(org.hint, config.orgs)
  const token = await generatePartyToken(config, actAs, readAs)
  return {
    accessToken: token,
    userId: current.userId,
    orgId: current.orgId,
    party: current.party,
    expiresAt: Date.now() + DEMO_TOKEN_LIFETIME_SEC * 1000,
  }
}

// Re-mint via the auth service's /auth/refresh endpoint. Used when the
// participant's parties rotated under us and we want a server-issued
// token compatible with the new boot. Throws on non-2xx so the caller
// can surface "couldn't auto-recover, please reload".
export async function remintViaRefresh(
  req: RemintRequest,
): Promise<{ state: AuthState; expiresIn: number }> {
  const res = await fetch(`${req.authUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`remintForRotation refresh failed: ${res.status}`)
  const data = (await res.json()) as LoginResponse
  return {
    state: {
      accessToken: data.accessToken,
      userId: data.userId,
      orgId: data.orgId,
      party: data.party,
      expiresAt: Date.now() + data.expiresIn * 1000,
    },
    expiresIn: data.expiresIn,
  }
}

export async function performRemintForRotation(req: RemintRequest): Promise<RemintOutcome | null> {
  if (req.config.auth.provider === 'demo') {
    const state = await remintDemoToken(req)
    return state ? { kind: 'demo', state } : null
  }
  const { state, expiresIn } = await remintViaRefresh(req)
  return { kind: 'refresh', state, expiresIn }
}
