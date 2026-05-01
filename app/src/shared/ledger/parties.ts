import * as jose from 'jose'
import type { ClientConfig } from '../config/client'

// Canton /v1/parties response shape.
interface PartyRecord {
  readonly identifier: string
  readonly displayName?: string
}
interface PartiesResponse {
  readonly result?: readonly PartyRecord[]
}

// Cache resolved party identifiers
let partyCache: Record<string, string> | null = null

async function resolvePartyIds(
  config: ClientConfig,
  hints: string[],
  secret: Uint8Array,
): Promise<string[]> {
  if (!partyCache) {
    try {
      // Bootstrap with a token using hints (for the /v1/parties query)
      const bootstrapToken = await new jose.SignJWT({
        'https://daml.com/ledger-api': {
          ledgerId: config.daml.ledgerId,
          applicationId: config.daml.applicationId,
          actAs: hints,
          readAs: [],
        },
      })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(secret)

      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bootstrapToken}` },
        body: JSON.stringify({ path: '/v1/parties', body: {} }),
      })
      if (res.ok) {
        const data = (await res.json()) as PartiesResponse
        partyCache = {}
        for (const p of data.result ?? []) {
          const shortName = p.identifier.split('::')[0] ?? p.identifier
          partyCache[shortName] = p.identifier
          if (p.displayName) partyCache[p.displayName] = p.identifier
        }
      }
    } catch {
      // Ledger not available — fall back to hints
    }
  }
  if (!partyCache) return hints
  return hints.map((h) => partyCache?.[h] ?? h)
}

/**
 * Mint an HS256 demo JWT for the Canton sandbox `--unsafe-jwt-token` mode.
 *
 * Refuses to run outside `auth.provider === "demo"` because the resulting
 * token is only accepted by the sandbox; calling this against a production
 * participant produces tokens that look valid but are silently rejected,
 * which is a confusing failure mode worth surfacing immediately.
 */
export async function generatePartyToken(
  config: ClientConfig,
  actAs: string[],
  readAs: string[] = [],
): Promise<string> {
  if (config.auth.provider !== 'demo' || !config.daml.unsafeJwtSecret) {
    throw new Error(
      `generatePartyToken called with auth.provider="${config.auth.provider}" — only valid in demo mode`,
    )
  }
  const secret = new TextEncoder().encode(config.daml.unsafeJwtSecret)
  const resolvedActAs = await resolvePartyIds(config, actAs, secret)
  const resolvedReadAs = await resolvePartyIds(config, readAs, secret)
  return await new jose.SignJWT({
    'https://daml.com/ledger-api': {
      ledgerId: config.daml.ledgerId,
      applicationId: config.daml.applicationId,
      actAs: resolvedActAs,
      readAs: resolvedReadAs,
    },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(secret)
}

/**
 * Compose widened actAs / readAs arrays for demo-mode JWTs.
 *
 * Demo mode is explicitly unsafe (see `daml.unsafeJwtSecret` in
 * shared-config). To let a single logged-in browser session exercise
 * multi-sig choices like `TerminateProposal` (signatories proposer +
 * operator), every demo JWT carries Operator authority in actAs and
 * Regulator + the other trading parties in readAs.
 *
 * Do NOT call from non-demo auth flows — they must stay scoped to a
 * single participant identity.
 */
export function demoActAsReadAs(
  orgHint: string,
  orgs: Array<{ hint: string }>,
): { actAs: string[]; readAs: string[] } {
  const actAs = [orgHint]
  if (orgHint !== 'Operator') actAs.push('Operator')

  const readAs: string[] = []
  if (orgHint !== 'Regulator') readAs.push('Regulator')
  for (const o of orgs) {
    if (o.hint === 'Operator' || o.hint === 'Regulator') continue
    if (actAs.includes(o.hint) || readAs.includes(o.hint)) continue
    readAs.push(o.hint)
  }
  return { actAs, readAs }
}
