'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/shared/contexts/auth-context'
import { useConfig } from '@/shared/contexts/config-context'

export default function OrgSelectorPage() {
  const router = useRouter()
  const { config, loading } = useConfig()
  const { isAuthenticated, state } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-950">
        <p className="text-zinc-400 text-sm">Loading...</p>
      </div>
    )
  }

  const orgs = config?.orgs ?? []
  const isDemo = config?.auth.provider === 'demo'

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur">
        <nav
          aria-label="Primary"
          className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4"
        >
          <a
            href="/org"
            className="flex items-center gap-2 text-white hover:text-zinc-200"
            aria-label="IRSForge home"
          >
            <img src="/favicon.svg" alt="" width={24} height={24} className="rounded-[4px]" />
            <span
              className="text-[18px] leading-none"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
            >
              IRSForge
            </span>
          </a>
          <div className="flex items-center gap-1 text-sm">
            <a
              href="https://irsforge.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-3 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
            >
              irsforge.com
            </a>
            <a
              href="https://docs.irsforge.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-3 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
            >
              Docs
            </a>
          </div>
        </nav>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          <div className="mb-10 flex flex-col items-center text-center">
            <img src="/favicon.svg" alt="" width={64} height={64} className="rounded-[8px]" />
            <h1
              className="mt-4 text-[44px] leading-none text-white"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
            >
              IRSForge
            </h1>
            <p className="mt-3 text-zinc-400">Select your organization</p>
            {isDemo && (
              <div
                className="mt-6 inline-flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left"
                role="note"
                aria-label="Demo mode notice"
              >
                <span className="mt-0.5 rounded-sm bg-amber-500/80 px-1.5 py-0.5 font-mono text-2xs font-semibold uppercase tracking-wider text-zinc-950">
                  Demo
                </span>
                <p className="text-xs text-amber-100/90">
                  Running with in-browser JWT minting. Pick any organization — no credentials
                  required. Not production auth.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  // Already authed for THIS org — skip the login-page flash
                  // and go straight to the blotter. Any other state (authed
                  // for a different org, or not authed at all) still needs
                  // /login, which re-mints or shows the form as appropriate.
                  if (isAuthenticated && state?.orgId === org.id) {
                    router.push(`/org/${org.id}/blotter`)
                  } else {
                    router.push(`/org/${org.id}/login`)
                  }
                }}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-800"
              >
                <p className="text-lg font-semibold text-white">{org.displayName}</p>
                <p className="mt-1 font-mono text-xs text-zinc-500 break-all">{org.party}</p>
              </button>
            ))}
          </div>

          {orgs.length === 0 && (
            <p className="text-center text-zinc-500 text-sm">No organizations configured.</p>
          )}
        </div>
      </div>
    </div>
  )
}
