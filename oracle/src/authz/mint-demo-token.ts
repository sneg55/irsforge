import type { Config } from 'irsforge-shared-config'
import * as jose from 'jose'
import { ENV } from '../shared/env.js'

// Shape of /v1/parties entries (just the fields we need).
interface PartyDetails {
  identifier: string
  displayName?: string
  isLocal?: boolean
}

/**
 * Mint an HS256 Operator JWT for the Canton sandbox's `--unsafe-jwt-token`
 * mode. Two-step bootstrap:
 *
 *   1. Sign a token whose actAs is the raw hint `"Operator"`. Canton's
 *      unsafe-jwt mode accepts this for authenticating the call even
 *      though the ledger itself requires a qualified `Party::1220…` form
 *      for actual writes.
 *   2. Use that token to query `/v1/parties` and find the qualified
 *      identifier whose short-name is `"Operator"` (or whose displayName
 *      matches). Re-sign with that qualified ID in actAs+readAs.
 *
 * Returns `null` when we cannot discover a qualified Operator party
 * (sandbox not up, or the Operator party hasn't been allocated yet). The
 * caller can then decide whether to fall back to a hint-only token or
 * fail loudly.
 *
 * Mirrors app/src/shared/ledger/parties.ts:resolvePartyIds so the oracle
 * and the frontend share the exact same bootstrap protocol.
 */
export async function mintDemoOperatorToken(config: Config): Promise<string | null> {
  if (config.auth.provider !== 'demo' || !config.daml.unsafeJwtSecret) {
    return null
  }
  const secret = new TextEncoder().encode(config.daml.unsafeJwtSecret)
  const ledgerId = config.daml.ledgerId
  const applicationId = config.daml.applicationId

  const bootstrap = await signToken(secret, ledgerId, applicationId, ['Operator'], [])

  const baseUrl = `http://${ENV.LEDGER_HOST()}:${ENV.LEDGER_PORT()}`
  let parties: PartyDetails[]
  try {
    const res = await fetch(`${baseUrl}/v1/parties`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${bootstrap}` },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: PartyDetails[] }
    parties = json.result ?? []
  } catch {
    return null
  }

  const operator = parties.find((p) => {
    const shortName = p.identifier.split('::')[0]
    return shortName === 'Operator' || p.displayName === 'Operator'
  })
  if (!operator) return null

  // readAs widened to ALL known parties so the oracle can observe what
  // it writes (needed for idempotency queries on NYFedObservation +
  // Daml Finance Observation).
  const readAs = parties.map((p) => p.identifier)

  return await signToken(secret, ledgerId, applicationId, [operator.identifier], readAs)
}

async function signToken(
  secret: Uint8Array,
  ledgerId: string,
  applicationId: string,
  actAs: string[],
  readAs: string[],
): Promise<string> {
  return await new jose.SignJWT({
    'https://daml.com/ledger-api': {
      ledgerId,
      applicationId,
      actAs,
      readAs,
    },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(secret)
}
