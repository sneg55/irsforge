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
