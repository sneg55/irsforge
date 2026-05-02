/* eslint-disable complexity -- React idiomatic conditional patterns + LoginPage dispatches across 3 auth providers (demo/builtin/oidc); both rules' project config notes "Revisit after the easy cleanup sprints". */
'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { resolveAuthUrl } from '@/shared/config/client'
import { defaultLandingRoute } from '@/shared/constants/routes'
import { useAuth } from '@/shared/contexts/auth-context'
import { useConfig } from '@/shared/contexts/config-context'

export default function LoginPage() {
  const params = useParams()
  const router = useRouter()
  const { login, loginAsDemoParty, isAuthenticated, isInitialized, state } = useAuth()
  const { config, loading } = useConfig()

  const orgId =
    typeof params.orgId === 'string'
      ? params.orgId
      : Array.isArray(params.orgId)
        ? params.orgId[0]
        : ''

  // If already authed for THIS org, skip the login form. If authed for a
  // DIFFERENT org in demo mode, silently re-mint as the new org before
  // redirecting — otherwise the session's orgId and the URL disagree and
  // the blotter loads under the wrong party's JWT (the active header
  // shows demo:PartyA while the URL is /org/jpmorgan, and CPTY columns
  // lie about who the counterparty is).
  useEffect(() => {
    if (!isInitialized || !orgId) return
    if (!isAuthenticated) return
    const org = config?.orgs.find((o) => o.id === orgId)
    if (!org) return
    const landing = defaultLandingRoute(orgId, org.role)
    if (state?.orgId === orgId) {
      router.replace(landing)
      return
    }
    if (config?.auth.provider === 'demo') {
      void (async () => {
        await loginAsDemoParty(orgId)
        router.replace(landing)
      })()
    }
    // For non-demo providers with a mismatched org, fall through to the
    // normal login form below — the user has to re-auth.
  }, [isInitialized, isAuthenticated, state, orgId, config, router, loginAsDemoParty])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading || !config) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-950">
        <p className="text-zinc-400 text-sm">Loading...</p>
      </div>
    )
  }

  const org = config.orgs.find((o) => o.id === orgId)
  if (!org) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-950">
        <p className="text-red-400 text-sm">Unknown organization: {orgId}</p>
      </div>
    )
  }

  const provider = config.auth.provider
  const authorizationUrl =
    provider === 'oidc' && config.auth.oidc
      ? `${resolveAuthUrl(config)}/auth/authorize?orgId=${encodeURIComponent(orgId)}`
      : null
  const landing = defaultLandingRoute(orgId, org.role)

  async function handleBuiltinSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password, orgId)
      router.replace(landing)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDemoLogin() {
    setError(null)
    setSubmitting(true)
    try {
      await loginAsDemoParty(orgId)
      router.replace(landing)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/favicon.svg" alt="" width={48} height={48} className="rounded-[6px]" />
          <h1
            className="mt-3 text-[32px] leading-none text-white"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
          >
            IRSForge
          </h1>
          <p className="mt-2 text-sm text-zinc-400">{org.displayName}</p>
        </div>

        {provider === 'demo' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs text-zinc-500 text-center">
              Demo mode — logs you in as <code className="text-zinc-300">{org.hint}</code>.
            </p>
            <button
              onClick={handleDemoLogin}
              disabled={submitting}
              className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : `Log in as ${org.hint}`}
            </button>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        )}

        {provider === 'oidc' && (
          <div className="flex flex-col items-center gap-4">
            {authorizationUrl ? (
              <a
                href={authorizationUrl}
                className="w-full rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-black transition-colors hover:bg-zinc-100"
              >
                Sign in with SSO
              </a>
            ) : (
              <p className="text-red-400 text-sm">OIDC configuration missing.</p>
            )}
          </div>
        )}

        {provider === 'builtin' && (
          <form onSubmit={handleBuiltinSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="text-xs font-medium uppercase tracking-wide text-zinc-400"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-hidden focus:border-zinc-500 focus:ring-0"
                placeholder="Enter username"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wide text-zinc-400"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-hidden focus:border-zinc-500 focus:ring-0"
                placeholder="Enter password"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-zinc-600">
          <Link href="/org" className="hover:text-zinc-400 transition-colors">
            &larr; Switch organization
          </Link>
        </p>
      </div>
    </div>
  )
}
