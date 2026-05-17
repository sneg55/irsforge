export interface AuthRequest {
  username: string
  password: string
  orgId: string
}

export interface AuthResult {
  userId: string
  orgId: string
  party: string
  actAs: string[]
  readAs: string[]
}

export interface AuthProvider {
  authenticate(req: AuthRequest): Promise<AuthResult>
  /**
   * Build an IdP authorize URL. `state` is an opaque CSRF token validated
   * server-side on callback. `nonce` is the OIDC nonce that must appear in
   * the returned id_token.
   */
  getAuthorizationUrl?(state: string, nonce: string): string
  /**
   * Handle the IdP callback. `orgId` and `nonce` come from the server-side
   * state store (looked up by the opaque `state` URL param) — never trust
   * either value from the URL directly.
   */
  handleCallback?(code: string, orgId: string, nonce: string): Promise<AuthResult>
}

/**
 * Claims-based authorisation check. A verified OIDC identity is allowed
 * to mint a token for `org` only when one of:
 *   1. `profile === 'demo'` — party picker UX, no IdP binding.
 *   2. `org.role === 'operator'` — platform principal, exempt by design.
 *   3. The IdP `sub`/`email` claim is in `org.allowedSubjects`.
 *   4. One of the IdP `groups` claims is in `org.allowedGroups`.
 *
 * Throws on rejection. Pure function — providers (OIDC, builtin, future
 * SAML, …) call this with whatever shape of verified claims they hold.
 */
export interface IdpClaims {
  sub?: string
  email?: string
  groups?: string[]
}
export interface OrgLike {
  id: string
  role: 'trader' | 'operator' | 'regulator'
  allowedSubjects?: string[]
  allowedGroups?: string[]
}
export function assertOrgMembership(
  claims: IdpClaims,
  org: OrgLike,
  profile: 'demo' | 'production',
): void {
  if (profile === 'demo') return
  if (org.role === 'operator') return
  const subOk = (org.allowedSubjects ?? []).some((s) => s === claims.sub || s === claims.email)
  const grpOk = (org.allowedGroups ?? []).some((g) => claims.groups?.includes(g))
  if (!subOk && !grpOk) {
    throw new Error(
      `Identity ${claims.sub ?? claims.email ?? '(no sub)'} is not authorised for org ${org.id}`,
    )
  }
}
