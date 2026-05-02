export interface AuthState {
  accessToken: string
  userId: string
  orgId: string
  party: string
  expiresAt: number // unix timestamp ms
}

export interface LoginResponse {
  accessToken: string
  expiresIn: number // seconds
  userId: string
  orgId: string
  party: string
}

export interface AuthMeta {
  userId: string
  orgId: string
  party: string
}

export interface AuthContextValue {
  state: AuthState | null
  login: (username: string, password: string, orgId: string) => Promise<void>
  loginAsDemoParty: (orgId: string) => Promise<void>
  loginFromCallback: (
    token: string,
    expiresIn: number,
    userId: string,
    orgId: string,
    party: string,
  ) => void
  logout: () => Promise<void>
  getToken: () => string | null
  isAuthenticated: boolean
  /**
   * True once AuthProvider has had a chance to restore persisted state.
   * Route guards should wait for this before redirecting on !isAuthenticated
   * to avoid redirect-before-restore races on full-page loads.
   */
  isInitialized: boolean
  /**
   * Re-mint the access token after a sandbox-rotation event. Demo mode
   * drops the in-memory party-id cache and re-runs `generatePartyToken`
   * so the new JWT carries the freshly allocated qualified party IDs.
   * OIDC mode falls through to /auth/refresh — the auth service is
   * responsible for issuing a token compatible with the current
   * participant. No-op when there is no current session.
   */
  remintForRotation: () => Promise<void>
}
