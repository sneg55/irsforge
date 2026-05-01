'use client'

import { useRouter } from 'next/navigation'
import { ObserverBadge } from '@/features/regulator/components/observer-badge'
import { useAuth } from '../contexts/auth-context'
import { useConfig } from '../contexts/config-context'
import { useActiveOrgRole } from '../hooks/use-active-org-role'

interface AuthHeaderProps {
  orgId: string
}

const ROLE_LABEL: Record<'trader' | 'operator' | 'regulator', string> = {
  trader: 'Trader',
  operator: 'Operator',
  regulator: 'Regulator',
}

export function AuthHeader({ orgId }: AuthHeaderProps) {
  const router = useRouter()
  const { state, logout } = useAuth()
  const { getOrg } = useConfig()
  const role = useActiveOrgRole()

  const org = getOrg(orgId)
  const displayName = org?.displayName ?? orgId
  const rawUserId = state?.userId ?? ''
  const userId = rawUserId.startsWith('demo:') ? rawUserId.slice('demo:'.length) : rawUserId
  // When the user-id is just an echo of the org's display name (typical in
  // demo where org "Operator" has user "operator"), it adds no information.
  // Surface the role label instead so the header reads "<Org> / <Role>".
  const subline =
    userId && userId.toLowerCase() !== displayName.toLowerCase()
      ? userId
      : `${ROLE_LABEL[role]} role`

  async function handleLogout() {
    await logout()
    router.push('/org')
  }

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-3">
      <div className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" width={28} height={28} className="rounded-[4px]" />
        <span
          className="text-[22px] leading-none text-white"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
        >
          IRSForge
        </span>
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">
          Canton IRS Protocol
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-right">
          <ObserverBadge />
          <div>
            <p className="text-sm font-medium text-white">{displayName}</p>
            {subline && <p className="text-xs text-zinc-500">{subline}</p>}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
        >
          Logout
        </button>
      </div>
    </header>
  )
}
