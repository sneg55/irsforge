'use client'

import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { LedgerActivityToasts } from '@/features/ledger/components/ledger-activity-toasts'
import { LedgerActivityProvider } from '@/features/ledger/contexts/ledger-activity-provider'
import { ROUTES } from '@/shared/constants/routes'
import { useAuth } from '@/shared/contexts/auth-context'
import { useConfig } from '@/shared/contexts/config-context'
import { LedgerProvider } from '@/shared/contexts/ledger-context'
import { useActiveOrgRole } from '@/shared/hooks/use-active-org-role'
import { AuthHeader } from '@/shared/layout/auth-header'
import { FooterSlotProvider } from '@/shared/layout/footer-slot-context'
import { StatusBar } from '@/shared/layout/status-bar'

const TRADER_NAV = (orgId: string) => [
  { href: ROUTES.ORG_BLOTTER(orgId), label: 'Blotter' },
  { href: ROUTES.ORG_WORKSPACE(orgId), label: 'Workspace' },
  { href: ROUTES.ORG_CSA(orgId), label: 'CSAs' },
]

const OPERATOR_NAV = (orgId: string) => [
  { href: ROUTES.ORG_OPERATOR(orgId), label: 'Operator' },
  { href: ROUTES.ORG_BLOTTER(orgId), label: 'Blotter' },
  { href: ROUTES.ORG_WORKSPACE(orgId), label: 'Workspace' },
  { href: ROUTES.ORG_CSA(orgId), label: 'CSAs' },
]

const REGULATOR_NAV = (orgId: string, ledgerEnabled: boolean) => {
  const base = [
    { href: ROUTES.ORG_OVERSIGHT(orgId), label: 'Oversight' },
    { href: ROUTES.ORG_TIMELINE(orgId), label: 'Timeline' },
    { href: ROUTES.ORG_CSA_BOARD(orgId), label: 'CSA Board' },
  ]
  if (ledgerEnabled) base.push({ href: ROUTES.ORG_LEDGER(orgId), label: 'Ledger' })
  return base
}

const TRADER_ONLY_PATHS = ['/blotter', '/workspace', '/csa']
const OPERATOR_ONLY_PATHS = ['/operator']
const REGULATOR_ONLY_PATHS = ['/oversight', '/timeline', '/csa-board']

function landingForRole(orgId: string, role: 'trader' | 'operator' | 'regulator'): string {
  if (role === 'operator') return ROUTES.ORG_OPERATOR(orgId)
  if (role === 'regulator') return ROUTES.ORG_OVERSIGHT(orgId)
  return ROUTES.ORG_BLOTTER(orgId)
}

function pathIsForeignToRole(
  pathname: string,
  orgId: string,
  role: 'trader' | 'operator' | 'regulator',
): boolean {
  const suffix = pathname.replace(`/org/${orgId}`, '')
  if (
    role === 'trader' &&
    (OPERATOR_ONLY_PATHS.includes(suffix) || REGULATOR_ONLY_PATHS.includes(suffix))
  ) {
    return true
  }
  if (role === 'operator' && REGULATOR_ONLY_PATHS.includes(suffix)) {
    return true
  }
  if (
    role === 'regulator' &&
    (TRADER_ONLY_PATHS.includes(suffix) || OPERATOR_ONLY_PATHS.includes(suffix))
  ) {
    return true
  }
  return false
}

function OrgSidebar({ orgId }: { orgId: string }) {
  const pathname = usePathname()
  const role = useActiveOrgRole()
  const { config } = useConfig()
  const ledgerEnabled = config?.ledgerUi?.enabled ?? false
  const navItems =
    role === 'operator'
      ? OPERATOR_NAV(orgId)
      : role === 'regulator'
        ? REGULATOR_NAV(orgId, ledgerEnabled)
        : TRADER_NAV(orgId)

  return (
    <nav className="w-48 border-r border-zinc-800 bg-zinc-950 p-4">
      <ul className="space-y-1">
        {navItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block rounded px-3 py-2 text-sm ${
                pathname === item.href
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function ShellInner({ children, orgId }: { children: ReactNode; orgId: string }) {
  const role = useActiveOrgRole()
  const pathname = usePathname()
  const router = useRouter()

  // Compute foreignness synchronously so we can short-circuit the children
  // render on the SAME commit as the redirect schedule. Otherwise React
  // mounts the wrong-role page once before the effect fires — a regulator
  // hitting /operator briefly sees Co-sign / Resolve buttons.
  const isForeign = pathIsForeignToRole(pathname, orgId, role)

  useEffect(() => {
    if (isForeign) {
      router.replace(landingForRole(orgId, role))
    }
  }, [isForeign, orgId, role, router])

  if (isForeign) return null

  return (
    <>
      <AuthHeader orgId={orgId} />
      <div className="flex flex-1 overflow-hidden">
        <OrgSidebar orgId={orgId} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <StatusBar />
    </>
  )
}

export default function ShellLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isInitialized, state } = useAuth()
  const params = useParams()
  const router = useRouter()
  const { config } = useConfig()

  const orgId =
    typeof params.orgId === 'string'
      ? params.orgId
      : Array.isArray(params.orgId)
        ? params.orgId[0]
        : ''

  // Bounce through /login when the session's orgId doesn't match the URL's
  // — direct navigation to a sibling org used to let the page render under
  // the wrong JWT because the guard only checked isAuthenticated.
  const orgMismatch = isAuthenticated && state !== null && state.orgId !== orgId

  useEffect(() => {
    if (!isInitialized) return
    if (!isAuthenticated || orgMismatch) {
      router.replace(`/org/${orgId}/login`)
    }
  }, [isInitialized, isAuthenticated, orgMismatch, orgId, router])

  if (!isInitialized) {
    return (
      <div data-testid="shell-init-loading" className="flex min-h-0 flex-1 flex-col bg-zinc-950">
        <div className="flex h-14 items-center gap-3 border-b border-zinc-800 px-6">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="ml-auto h-5 w-32" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <nav className="w-48 border-r border-zinc-800 p-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
            </div>
          </nav>
          <main className="flex-1 space-y-4 p-6">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </div>
    )
  }
  if (!isAuthenticated || orgMismatch) return null

  const ledgerUi = config?.ledgerUi ?? {
    enabled: false,
    bufferSize: 500,
    templateFilter: { allow: [], deny: [] },
    toasts: { enabled: false, maxVisible: 3, dismissAfterMs: 5000 },
    rawPayload: { enabled: false },
  }

  return (
    <LedgerProvider>
      <FooterSlotProvider>
        <LedgerActivityProvider
          enabled={ledgerUi.enabled}
          bufferSize={ledgerUi.bufferSize}
          templateFilter={ledgerUi.templateFilter}
          persistKey={`irsforge.ledger-activity.${orgId}`}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <ShellInner orgId={orgId}>{children}</ShellInner>
            {ledgerUi.enabled && ledgerUi.toasts.enabled ? (
              <LedgerActivityToasts
                maxVisible={ledgerUi.toasts.maxVisible}
                dismissAfterMs={ledgerUi.toasts.dismissAfterMs}
                denyPrefixes={ledgerUi.templateFilter.deny}
                orgId={orgId}
              />
            ) : null}
          </div>
        </LedgerActivityProvider>
      </FooterSlotProvider>
    </LedgerProvider>
  )
}
