import type { Config } from 'irsforge-shared-config'
import * as jose from 'jose'
import { ENV } from '../shared/env.js'

interface PartyDetails {
  identifier: string
  displayName?: string
  isLocal?: boolean
}

/**
 * Mint an HS256 Scheduler JWT for the Canton sandbox's `--unsafe-jwt-token`
 * mode. Mirrors `mintDemoOperatorToken` but the qualified party in `actAs`
 * is the Scheduler, not the Operator. Operator is intentionally absent
 * from `actAs`: the scheduler's authority flows from the
 * scheduler-lifecycler `LifecycleRule` (providers = [operator, scheduler])
 * shipped in Phase 6 Stage C1, not from impersonating the operator.
 *
 * Returns `null` when the demo provider is off or the Scheduler party
 * has not been allocated yet (the oracle entrypoint logs and skips
 * scheduler startup in that case).
 */
export async function mintDemoSchedulerToken(config: Config): Promise<string | null> {
  if (config.auth.provider !== 'demo' || !config.daml.unsafeJwtSecret) {
    return null
  }

  const secret = new TextEncoder().encode(config.daml.unsafeJwtSecret)
  const ledgerId = config.daml.ledgerId
  const applicationId = config.daml.applicationId

  const bootstrap = await signToken(secret, ledgerId, applicationId, ['Scheduler'], [])

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

  const scheduler = parties.find((p) => {
    const shortName = p.identifier.split('::')[0]
    return shortName === 'Scheduler' || p.displayName === 'Scheduler'
  })
  if (!scheduler) return null

  // readAs widened to all parties. The scheduler needs to observe:
  //   - SwapWorkflow (signed by partyA+partyB) for the trigger tick.
  //   - Csa + NettedBatch (signed by partyA+partyB) for the settle-net tick.
  //   - Daml Finance Effect contracts (signed by depository/issuer).
  // Without readAs coverage the tick queries would 403 on the pre-C1
  // contracts. The scheduler never writes on their behalf — actAs stays
  // scheduler-only.
  const readAs = parties.map((p) => p.identifier)

  return await signToken(secret, ledgerId, applicationId, [scheduler.identifier], readAs)
}

async function signToken(
  secret: Uint8Array,
  ledgerId: string,
  applicationId: string,
  actAs: string[],
  readAs: string[],
): Promise<string> {
  return await new jose.SignJWT({
    'https://daml.com/ledger-api': { ledgerId, applicationId, actAs, readAs },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(secret)
}
