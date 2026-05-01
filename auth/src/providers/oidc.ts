import type { Org } from 'irsforge-shared-config'
import { createRemoteJWKSet, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from 'jose'
import type { AuthProvider, AuthRequest, AuthResult } from './interface.js'

export interface OidcConfig {
  authority: string
  clientId: string
  clientSecret: string
  scopes: string[]
  callbackUrl: string
}

interface OidcDiscovery {
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
  issuer: string
}

interface OidcTokenResponse {
  id_token: string
  access_token: string
  token_type: string
}

export class OidcProvider implements AuthProvider {
  private discovery: OidcDiscovery | null = null
  private jwks: JWTVerifyGetKey | null = null

  constructor(
    private readonly config: OidcConfig,
    private readonly orgs: Org[],
  ) {}

  private async discover(): Promise<OidcDiscovery> {
    if (this.discovery) {
      return this.discovery
    }
    const url = `${this.config.authority}/.well-known/openid-configuration`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`OIDC discovery failed: ${response.status} ${response.statusText}`)
    }
    this.discovery = (await response.json()) as OidcDiscovery
    return this.discovery
  }

  /**
   * Cryptographically verifies an id_token: checks the IdP's signature
   * against the discovered JWKS, enforces issuer / audience / expiry, and
   * confirms the OIDC nonce matches the value we generated when starting
   * the flow. Returns the verified claims on success; throws otherwise.
   */
  private async verifyIdToken(idToken: string, expectedNonce: string): Promise<JWTPayload> {
    const discovery = await this.discover()
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(discovery.jwks_uri))
    }
    const { payload } = await jwtVerify(idToken, this.jwks, {
      issuer: discovery.issuer,
      audience: this.config.clientId,
    })
    if (payload['nonce'] !== expectedNonce) {
      throw new Error('OIDC nonce mismatch')
    }
    return payload
  }

  getAuthorizationUrl(state: string, nonce: string): string {
    const { authority, clientId, scopes, callbackUrl } = this.config
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: scopes.join(' '),
      redirect_uri: callbackUrl,
      state,
      nonce,
    })
    return `${authority}/authorize?${params.toString()}`
  }

  async handleCallback(code: string, orgId: string, nonce: string): Promise<AuthResult> {
    const { clientId, clientSecret, callbackUrl } = this.config

    const discovery = await this.discover()

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      client_id: clientId,
      client_secret: clientSecret,
    })

    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText} — ${text}`)
    }

    const tokens = (await response.json()) as OidcTokenResponse
    const claims = await this.verifyIdToken(tokens.id_token, nonce)

    const org = this.orgs.find((o) => o.id === orgId)
    if (!org) {
      throw new Error(`Unknown orgId in OIDC callback: ${orgId}`)
    }

    const email = typeof claims['email'] === 'string' ? claims['email'] : undefined
    const userId = email ?? claims.sub
    if (!userId) {
      throw new Error('OIDC id_token missing sub claim')
    }

    return {
      userId: `${userId}::${orgId}`,
      orgId,
      party: org.party,
      actAs: [org.party],
      readAs: [org.party],
    }
  }

  authenticate(_req: AuthRequest): Promise<AuthResult> {
    return Promise.reject(
      new Error(
        'OIDC provider uses redirect flow — call getAuthorizationUrl and handleCallback instead',
      ),
    )
  }
}
