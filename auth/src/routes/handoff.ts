import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HandoffStore } from '../auth/handoff-store.js'
import { readBody, send, sendError } from './shared.js'

interface HandoffBody {
  handoff?: unknown
}

interface HandoffContext {
  handoffStore: HandoffStore
}

export async function handleHandoff(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: HandoffContext,
): Promise<void> {
  let body: HandoffBody
  try {
    const raw = await readBody(req)
    body = JSON.parse(raw) as HandoffBody
  } catch {
    sendError(res, 400, 'Invalid JSON body')
    return
  }

  const { handoff } = body
  if (typeof handoff !== 'string' || handoff.length === 0) {
    sendError(res, 400, 'handoff is required')
    return
  }

  const entry = ctx.handoffStore.consume(handoff)
  if (!entry) {
    sendError(res, 401, 'invalid_handoff')
    return
  }

  send(res, 200, {
    accessToken: entry.accessToken,
    expiresIn: entry.expiresIn,
    userId: entry.userId,
    orgId: entry.orgId,
    party: entry.party,
  })
}
