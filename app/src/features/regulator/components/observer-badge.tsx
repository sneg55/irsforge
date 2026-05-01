'use client'

import { useActiveOrgRole } from '@/shared/hooks/use-active-org-role'

/**
 * Visual marker rendered in AuthHeader when the active role is regulator.
 * Communicates "this account cannot trade" at a glance without forcing
 * users (or demo viewers) to read the sidebar.
 */
export function ObserverBadge() {
  const role = useActiveOrgRole()
  if (role !== 'regulator') return null
  return (
    <span
      className="rounded border border-yellow-700/50 bg-yellow-900/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-yellow-300"
      title="Observer mode — this account has read-only access"
    >
      OBSERVER
    </span>
  )
}
