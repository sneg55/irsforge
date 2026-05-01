import type { IncomingMessage, ServerResponse } from 'node:http'
import { ENV } from '../shared/env.js'

/**
 * Middleware-style guard for write endpoints. Returns true if the request
 * was handled (responded 403) and should NOT proceed; false if the handler
 * may continue. In live mode, all writes are rejected because the
 * scheduler owns ledger writes. In demo mode, writes are allowed (UI
 * triggers publishes).
 */
export function writeGuard(_req: IncomingMessage, res: ServerResponse): boolean {
  if (ENV.MODE() === 'demo') return false
  const body = JSON.stringify({
    error: 'write endpoints disabled in live mode — scheduler owns publishes',
  })
  res.writeHead(403, { 'Content-Type': 'application/json' })
  res.end(body)
  return true
}
