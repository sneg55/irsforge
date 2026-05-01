'use client'

import { PARTIES } from '../constants/parties'
import { partyMatchesHint } from '../ledger/party-match'
import { useActiveOrgRole } from './use-active-org-role'

/**
 * True iff the given party is the platform Operator. Pure function so
 * non-component code can share the same rule.
 *
 * Uses `partyMatchesHint` so the comparison is correct for both
 * `'Operator'` (demo path: bare hint) and `'Operator::fingerprint'`
 * (builtin/OIDC path: full Canton id). A naive `=== PARTIES.OPERATOR.hint`
 * was the bug in v1 — it broke for production deployments where the
 * session party is the full id.
 */
export function isOperatorParty(party: string | null | undefined): boolean {
  if (party === null || party === undefined || party === '') return false
  return partyMatchesHint(party, PARTIES.OPERATOR.hint)
}

export function useIsOperator(): boolean {
  return useActiveOrgRole() === 'operator'
}

/** True iff the given party is the platform Regulator. Same hint/full-id
 *  handling as `isOperatorParty`. */
export function isRegulatorParty(party: string | null | undefined): boolean {
  if (party === null || party === undefined || party === '') return false
  return partyMatchesHint(party, PARTIES.REGULATOR.hint)
}

/** True when the active party's role is regulator. UX-truth gate; pair with
 *  the per-controller authorization gate (`isProposer || isCounterparty`) to
 *  defend both bug classes. */
export function useIsRegulator(): boolean {
  return useActiveOrgRole() === 'regulator'
}
