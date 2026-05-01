import { ENV } from '../shared/env.js'
import { LedgerClient, type TokenProvider } from '../shared/ledger-client.js'

export function loadOperatorToken(): string {
  const token = ENV.OPERATOR_TOKEN()
  if (!token) {
    throw new Error('OPERATOR_TOKEN environment variable required for ledger writes')
  }
  return token
}

/**
 * Create a LedgerClient for publishing to the ledger.
 *
 * If an explicit `token` is passed, it wins (used by index.ts after it
 * mints a demo token via `mintDemoOperatorToken`). Otherwise falls back
 * to the OPERATOR_TOKEN env var.
 *
 * Passing `""` results in a client that can authenticate against Canton's
 * `--unsafe-jwt-token` mode for reads (any token shape is accepted), but
 * writes will 401 until a real signed token is supplied. The oracle's
 * startup path refuses to boot demo mode without an issued or minted
 * token — see `index.ts` for the guard.
 */
export function createLedgerClient(
  token?: string | TokenProvider,
  timeoutMs?: number,
): LedgerClient {
  const resolved = token ?? ENV.OPERATOR_TOKEN()
  return new LedgerClient(resolved, timeoutMs !== undefined ? { timeoutMs } : {})
}
