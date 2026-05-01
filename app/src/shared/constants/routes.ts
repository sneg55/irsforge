import type { OrgRole } from '../config/client'

export const ROUTES = {
  HOME: '/',
  ORG_SELECTOR: '/org',
  ORG_HOME: (orgId: string) => `/org/${orgId}`,
  ORG_LOGIN: (orgId: string) => `/org/${orgId}/login`,
  ORG_CALLBACK: (orgId: string) => `/org/${orgId}/callback`,
  ORG_BLOTTER: (orgId: string) => `/org/${orgId}/blotter`,
  ORG_CSA: (orgId: string) => `/org/${orgId}/csa`,
  ORG_WORKSPACE: (orgId: string) => `/org/${orgId}/workspace`,
  ORG_OPERATOR: (orgId: string) => `/org/${orgId}/operator`,
  ORG_OVERSIGHT: (orgId: string) => `/org/${orgId}/oversight`,
  ORG_TIMELINE: (orgId: string) => `/org/${orgId}/timeline`,
  ORG_CSA_BOARD: (orgId: string) => `/org/${orgId}/csa-board`,
  ORG_WORKSPACE_DRAFT: (orgId: string, id: string) => `/org/${orgId}/workspace?draft=${id}`,
  ORG_WORKSPACE_SWAP: (orgId: string, id: string) => `/org/${orgId}/workspace?swap=${id}`,
  ORG_LEDGER: (orgId: string) => `/org/${orgId}/ledger`,
  ORG_LEDGER_CID: (orgId: string, cid: string) =>
    `/org/${orgId}/ledger?cid=${encodeURIComponent(cid)}`,
} as const

/**
 * Per-role landing URL. Pass `org.role` from config (sourced via
 * `useConfig().getOrg(orgId)?.role` or the LedgerContext's `activeOrg`).
 *
 * Why role-driven, not hint-driven: `partyHint` works for the demo path
 * but production OIDC/builtin auth uses full `Hint::fingerprint` party
 * ids — comparing to a bare hint silently routes every regulator/operator
 * to `/blotter`. The `OrgRole` enum is the only authoritative source.
 */
export function defaultLandingRoute(orgId: string, role: OrgRole): string {
  if (role === 'operator') return ROUTES.ORG_OPERATOR(orgId)
  if (role === 'regulator') return ROUTES.ORG_OVERSIGHT(orgId)
  return ROUTES.ORG_BLOTTER(orgId)
}
