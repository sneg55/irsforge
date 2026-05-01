import type { ServiceAccountsRegistry } from '../service-accounts/registry.js'
import { createDamlToken } from '../tokens/issuer.js'

export interface OAuthTokenRequest {
  contentType: string | undefined
  rawBody: string
}

export interface ServiceAccountMetadata {
  id: string
  actAs: string[]
  readAs: string[]
}

export interface OAuthTokenContext {
  registry: ServiceAccountsRegistry
  keys: { privateKey: CryptoKey }
  issuer: string
  tokenTtlSeconds: number
  ledgerId: string
  applicationId: string
  accounts: ServiceAccountMetadata[]
}

export interface OAuthTokenResponse {
  status: number
  body: Record<string, unknown>
}

const URLENCODED = 'application/x-www-form-urlencoded'

function err(status: number, error: string, description?: string): OAuthTokenResponse {
  const body: Record<string, unknown> = { error }
  if (description !== undefined) body.error_description = description
  return { status, body }
}

export async function handleOAuthToken(
  req: OAuthTokenRequest,
  ctx: OAuthTokenContext,
): Promise<OAuthTokenResponse> {
  if (!req.contentType?.startsWith(URLENCODED)) {
    return err(415, 'invalid_request', `Content-Type must be ${URLENCODED}`)
  }

  const params = new URLSearchParams(req.rawBody)
  const grantType = params.get('grant_type')
  const clientId = params.get('client_id')
  const clientSecret = params.get('client_secret')

  if (grantType !== 'client_credentials') {
    return err(400, 'unsupported_grant_type')
  }
  if (
    typeof clientId !== 'string' ||
    clientId.length === 0 ||
    typeof clientSecret !== 'string' ||
    clientSecret.length === 0
  ) {
    return err(400, 'invalid_request', 'client_id and client_secret required')
  }

  const ok = await ctx.registry.verify(clientId, clientSecret)
  if (!ok) {
    return err(401, 'invalid_client')
  }

  const account = ctx.accounts.find((a) => a.id === clientId)
  if (!account) {
    return err(500, 'server_error', `service account "${clientId}" missing in auth config`)
  }

  const accessToken = await createDamlToken(ctx.keys.privateKey, {
    userId: `service:${clientId}`,
    orgId: '',
    actAs: account.actAs,
    readAs: account.readAs,
    issuer: ctx.issuer,
    ttlSeconds: ctx.tokenTtlSeconds,
    ledgerId: ctx.ledgerId,
    applicationId: ctx.applicationId,
  })

  return {
    status: 200,
    body: {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ctx.tokenTtlSeconds,
    },
  }
}
