import type { IncomingMessage, ServerResponse } from 'node:http'
import type { JwksDocument, KeyPairResult } from '../keys/manager.js'
import { exportJwks } from '../keys/manager.js'

let _cachedJwks: string | null = null

export async function handleJwks(
  _req: IncomingMessage,
  res: ServerResponse,
  keys: KeyPairResult,
): Promise<void> {
  if (!_cachedJwks) {
    const jwks: JwksDocument = await exportJwks(keys.publicKey, keys.kid)
    _cachedJwks = JSON.stringify(jwks)
  }

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  })
  res.end(_cachedJwks)
}

/** Reset the cache — useful for testing. */
export function resetJwksCache(): void {
  _cachedJwks = null
}
