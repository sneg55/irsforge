import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Org } from 'irsforge-shared-config'
import type { KeyPairResult } from '../keys/manager.js'
import { createDamlToken } from '../tokens/issuer.js'
import type { RefreshTokenStore } from '../tokens/refresh.js'
import { parseCookies, send, sendError } from './shared.js'

const REFRESH_COOKIE_NAME = 'irsforge_refresh'

interface RefreshContext {
  keys: KeyPairResult
  tokenStore: RefreshTokenStore
  orgs: Org[]
  issuer: string
  tokenTtlSeconds: number
  refreshTtlSeconds: number
  ledgerId: string
  applicationId: string
}

export async function handleRefresh(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RefreshContext,
): Promise<void> {
  const cookies = parseCookies(req)
  const oldToken = cookies[REFRESH_COOKIE_NAME]

  if (!oldToken) {
    sendError(res, 401, 'No refresh token')
    return
  }

  const newToken = ctx.tokenStore.rotate(oldToken)

  if (!newToken) {
    sendError(res, 401, 'Invalid or expired refresh token')
    return
  }

  const session = ctx.tokenStore.validate(newToken)

  if (!session) {
    sendError(res, 401, 'Invalid session')
    return
  }

  const org = ctx.orgs.find((o) => o.id === session.orgId)

  if (!org) {
    sendError(res, 401, 'Unknown org')
    return
  }

  const accessToken = await createDamlToken(ctx.keys.privateKey, {
    userId: session.userId,
    orgId: session.orgId,
    actAs: session.actAs,
    readAs: session.readAs,
    issuer: ctx.issuer,
    ttlSeconds: ctx.tokenTtlSeconds,
    ledgerId: ctx.ledgerId,
    applicationId: ctx.applicationId,
  })

  const cookieValue = `${REFRESH_COOKIE_NAME}=${newToken}; HttpOnly; SameSite=Strict; Path=/auth; Max-Age=${ctx.refreshTtlSeconds}`
  res.setHeader('Set-Cookie', cookieValue)

  send(res, 200, {
    accessToken,
    expiresIn: ctx.tokenTtlSeconds,
    userId: session.userId,
    orgId: session.orgId,
    party: org.party,
  })
}
