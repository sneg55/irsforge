'use client'

import type { OrgRole } from '../config/client'
import { useConfig } from '../contexts/config-context'
import { useLedger } from '../contexts/ledger-context'
import { partyMatchesHint } from '../ledger/party-match'

/**
 * Resolves the active party's platform role.
 *
 * Lookup order:
 *   1. `activeOrg.role` — set by LedgerProvider from the session's orgId.
 *      Authoritative when present; works for every auth provider.
 *   2. Demo-only fallback: scan `config.orgs` and match `activeParty` against
 *      each `org.party` (full Canton id `Hint::fingerprint`) AND `org.hint`
 *      (bare hint) via `partyMatchesHint`. Hit when `profile === 'demo'`,
 *      where the YAML config is a global registry of every party.
 *   3. Last resort: `'trader'` plus a console warning. In `profile === 'production'`
 *      the hint-scan does not run — production deployments don't have a
 *      shared registry of every counterparty's party id, so the scan would
 *      either silently return `'trader'` or coincidentally match a foreign
 *      hint. Either is worse than a loud error.
 *
 * Why both fields in the demo path: builtin/OIDC auth
 * (`auth/src/providers/builtin.ts:61`) sets the session party to `org.party`
 * (a full `Hint::fingerprint`), while the demo path sets it to `org.hint`.
 * A naive `=== org.hint` compare breaks production logins silently.
 */
export function useActiveOrgRole(): OrgRole {
  const { activeParty, activeOrg } = useLedger()
  const { config } = useConfig()

  if (activeOrg !== null) return activeOrg.role

  if (activeParty === null || activeParty === '' || !config?.orgs) return 'trader'

  if (config.profile !== 'demo') {
    console.error(
      `useActiveOrgRole: activeOrg unresolved under profile='${config.profile}' for activeParty='${activeParty}'. ` +
        `Production deployments must populate activeOrg before this hook runs; defaulting to 'trader'.`,
    )
    return 'trader'
  }

  const org = config.orgs.find(
    (o) =>
      (o.party !== '' && partyMatchesHint(activeParty, o.party)) ||
      (o.hint !== '' && partyMatchesHint(activeParty, o.hint)),
  )
  if (org === undefined) {
    console.warn(
      `useActiveOrgRole: no org matches activeParty='${activeParty}'; defaulting to 'trader'`,
    )
    return 'trader'
  }
  return org.role
}
