import type { IncomingMessage, ServerResponse } from 'node:http'
import type { KeyPairResult } from '../keys/manager.js'
import type { AuthProvider } from '../providers/interface.js'
import { createDamlToken } from '../tokens/issuer.js'
import type { RefreshTokenStore } from '../tokens/refresh.js'
import { readBody, send, sendError } from './shared.js'

interface LoginBody {
  username?: unknown
  password?: unknown
  orgId?: unknown
}

interface LoginContext {
  provider: AuthProvider
  keys: KeyPairResult
  tokenStore: RefreshTokenStore
  issuer: string
  tokenTtlSeconds: number
  refreshTtlSeconds: number
  ledgerId: string
  applicationId: string
}

export async function handleLogin(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: LoginContext,
): Promise<void> {
  let body: LoginBody

  try {
    const raw = await readBody(req)
    body = JSON.parse(raw) as LoginBody
  } catch {
    sendError(res, 400, 'Invalid JSON body')
    return
  }

  const { username, password, orgId } = body

  if (typeof username !== 'string' || typeof password !== 'string' || typeof orgId !== 'string') {
    sendError(res, 400, 'username, password, and orgId are required')
    return
  }

  let authResult: Awaited<ReturnType<AuthProvider['authenticate']>>

  try {
    authResult = await ctx.provider.authenticate({ username, password, orgId })
  } catch {
    sendError(res, 401, 'Invalid credentials')
    return
  }

  const { userId, party, actAs, readAs } = authResult

  const accessToken = await createDamlToken(ctx.keys.privateKey, {
    userId,
    orgId,
    actAs,
    readAs,
    issuer: ctx.issuer,
    ttlSeconds: ctx.tokenTtlSeconds,
    ledgerId: ctx.ledgerId,
    applicationId: ctx.applicationId,
  })

  const refreshToken = ctx.tokenStore.create(userId, orgId, actAs, readAs)

  const cookieValue = `irsforge_refresh=${refreshToken}; HttpOnly; SameSite=Strict; Path=/auth; Max-Age=${ctx.refreshTtlSeconds}`
  res.setHeader('Set-Cookie', cookieValue)

  send(res, 200, {
    accessToken,
    expiresIn: ctx.tokenTtlSeconds,
    userId,
    orgId,
    party,
  })
}
