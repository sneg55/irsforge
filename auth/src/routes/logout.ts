import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RefreshTokenStore } from '../tokens/refresh.js'
import { parseCookies, send } from './shared.js'

const REFRESH_COOKIE_NAME = 'irsforge_refresh'
const CLEAR_COOKIE = `${REFRESH_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/auth; Max-Age=0`

interface LogoutContext {
  tokenStore: RefreshTokenStore
}

export function handleLogout(req: IncomingMessage, res: ServerResponse, ctx: LogoutContext): void {
  const cookies = parseCookies(req)
  const token = cookies[REFRESH_COOKIE_NAME]

  if (token) {
    ctx.tokenStore.revoke(token)
  }

  res.setHeader('Set-Cookie', CLEAR_COOKIE)
  send(res, 200, { ok: true })
}
