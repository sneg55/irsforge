'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { resolveAuthUrl } from '@/shared/config/client'
import { defaultLandingRoute } from '@/shared/constants/routes'
import { useAuth } from '@/shared/contexts/auth-context'
import { useConfig } from '@/shared/contexts/config-context'

interface HandoffResponse {
  accessToken: string
  expiresIn: number
  userId: string
  orgId: string
  party: string
}

export default function CallbackPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loginFromCallback } = useAuth()
  const { config } = useConfig()
  const [errorText, setErrorText] = useState<string | null>(null)

  const orgId =
    typeof params.orgId === 'string'
      ? params.orgId
      : Array.isArray(params.orgId)
        ? params.orgId[0]
        : ''

  const handoff = searchParams.get('handoff')
  const error = searchParams.get('error')

  // The handoff exchange must run exactly once even under StrictMode double-invoke,
  // because the server enforces one-time-use and the second call would 401.
  const exchangedRef = useRef(false)

  useEffect(() => {
    if (error) {
      router.replace(`/org/${orgId}/login?error=${encodeURIComponent(error)}`)
      return
    }
    if (!handoff || !config) return
    if (exchangedRef.current) return
    exchangedRef.current = true

    void (async () => {
      try {
        const authUrl = resolveAuthUrl(config)
        const res = await fetch(`${authUrl}/auth/handoff`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handoff }),
        })
        if (!res.ok) {
          throw new Error(`handoff_failed_${res.status}`)
        }
        const data = (await res.json()) as HandoffResponse
        loginFromCallback(data.accessToken, data.expiresIn, data.userId, data.orgId, data.party)
        // Scrub the handoff code from the visible URL even though it's already
        // been consumed server-side.
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', window.location.pathname)
        }
        const org = config.orgs.find((o) => o.id === data.orgId)
        router.replace(
          org ? defaultLandingRoute(data.orgId, org.role) : `/org/${data.orgId}/blotter`,
        )
      } catch (err) {
        setErrorText(err instanceof Error ? err.message : 'handoff_failed')
        router.replace(`/org/${orgId}/login?error=handoff_failed`)
      }
    })()
  }, [handoff, error, orgId, router, loginFromCallback, config])

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-950">
      <p className="text-zinc-400 text-sm">
        {errorText ? `Sign-in failed: ${errorText}` : 'Completing sign-in...'}
      </p>
    </div>
  )
}
