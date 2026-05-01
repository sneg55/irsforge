'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { resolveAuthUrl } from '../config/client'
import { demoActAsReadAs, generatePartyToken } from '../ledger/parties'
import { loadStoredAuthMeta, writeAuthMeta } from './auth-storage'
import type { AuthContextValue, AuthState, LoginResponse } from './auth-types'
import { useConfig } from './config-context'

const noopAsync = (): Promise<void> => Promise.resolve()
const noop = (): void => undefined

const AuthContext = createContext<AuthContextValue>({
  state: null,
  login: noopAsync,
  loginAsDemoParty: noopAsync,
  loginFromCallback: noop,
  logout: noopAsync,
  getToken: () => null,
  isAuthenticated: false,
  isInitialized: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  // SSR-safe: server render sees state=null and isInitialized=false; client
  // hydration restores from localStorage in the effect below and flips
  // isInitialized true on the same pass. Route guards gate on
  // isInitialized to avoid false-negative redirects during that window.
  const [state, setState] = useState<AuthState | null>(null)
  const [isInitialized, setIsInitialized] = useState<boolean>(false)
  const { config } = useConfig()

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  const getAuthUrl = useCallback((): string => {
    if (!config) throw new Error('auth called before config loaded')
    return resolveAuthUrl(config)
  }, [config])

  const scheduleRefresh = useCallback(
    (expiresIn: number) => {
      clearRefreshTimer()
      const delayMs = Math.max(0, (expiresIn - 60) * 1000)
      refreshTimerRef.current = setTimeout(() => {
        void (async () => {
          try {
            const res = await fetch(`${getAuthUrl()}/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
            })
            if (!res.ok) throw new Error(`Refresh failed: ${res.status}`)
            const data = (await res.json()) as LoginResponse
            setState({
              accessToken: data.accessToken,
              userId: data.userId,
              orgId: data.orgId,
              party: data.party,
              expiresAt: Date.now() + data.expiresIn * 1000,
            })
            scheduleRefresh(data.expiresIn)
          } catch (err) {
            console.error('Silent refresh failed:', err)
            setState(null)
          }
        })()
      }, delayMs)
    },
    [clearRefreshTimer, getAuthUrl],
  )

  // Restore session on mount. We persist only non-secret identity meta in
  // localStorage; the access token itself is recovered from the HttpOnly
  // refresh cookie via /auth/refresh. Demo mode has no server session, so
  // for `provider === "demo"` we just remint a token from the public
  // demo HMAC secret using the persisted org identity.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Wait for config before deciding anything. Flipping isInitialized
      // before config arrives would let the persist effect write a null
      // meta and wipe the blob we're about to read.
      if (!config) return
      const meta = loadStoredAuthMeta()
      if (!meta) {
        if (!cancelled) setIsInitialized(true)
        return
      }
      try {
        if (config.auth.provider === 'demo') {
          const org = config.orgs.find((o) => o.id === meta.orgId)
          if (!org) throw new Error('unknown_org')
          const { actAs, readAs } = demoActAsReadAs(org.hint, config.orgs)
          const token = await generatePartyToken(config, actAs, readAs)
          const expiresIn = 24 * 60 * 60
          if (!cancelled) {
            setState({
              accessToken: token,
              userId: meta.userId,
              orgId: meta.orgId,
              party: meta.party,
              expiresAt: Date.now() + expiresIn * 1000,
            })
          }
        } else {
          const res = await fetch(`${resolveAuthUrl(config)}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          })
          if (!res.ok) throw new Error(`refresh_${res.status}`)
          const data = (await res.json()) as LoginResponse
          if (!cancelled) {
            setState({
              accessToken: data.accessToken,
              userId: data.userId,
              orgId: data.orgId,
              party: data.party,
              expiresAt: Date.now() + data.expiresIn * 1000,
            })
            scheduleRefresh(data.expiresIn)
          }
        }
      } catch {
        // Cookie expired / cleared / no session — drop the stale meta and
        // let the route guards send the user to login.
        writeAuthMeta(null)
      } finally {
        if (!cancelled) setIsInitialized(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [config])

  // Persist only the non-secret identity tuple. The access token never
  // leaves React state — XSS can no longer exfiltrate a long-lived token
  // from localStorage, only one captured at the moment of attack.
  useEffect(() => {
    if (!isInitialized) return
    if (state) {
      writeAuthMeta({ userId: state.userId, orgId: state.orgId, party: state.party })
    } else {
      writeAuthMeta(null)
    }
  }, [state, isInitialized])

  const login = useCallback(
    async (username: string, password: string, orgId: string): Promise<void> => {
      const res = await fetch(`${getAuthUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, orgId }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Login failed (${res.status}): ${text}`)
      }
      const data = (await res.json()) as LoginResponse
      setState({
        accessToken: data.accessToken,
        userId: data.userId,
        orgId: data.orgId,
        party: data.party,
        expiresAt: Date.now() + data.expiresIn * 1000,
      })
      scheduleRefresh(data.expiresIn)
    },
    [scheduleRefresh, getAuthUrl],
  )

  const loginAsDemoParty = useCallback(
    async (orgId: string): Promise<void> => {
      if (!config) throw new Error('config not loaded')
      const org = config.orgs.find((o) => o.id === orgId)
      if (!org) throw new Error(`Unknown org: ${orgId}`)
      const { actAs, readAs } = demoActAsReadAs(org.hint, config.orgs)
      const token = await generatePartyToken(config, actAs, readAs)
      const expiresIn = 24 * 60 * 60
      setState({
        accessToken: token,
        userId: `demo:${org.hint}`,
        orgId,
        party: org.hint,
        expiresAt: Date.now() + expiresIn * 1000,
      })
    },
    [config],
  )

  const loginFromCallback = useCallback(
    (token: string, expiresIn: number, userId: string, orgId: string, party: string) => {
      setState({
        accessToken: token,
        userId,
        orgId,
        party,
        expiresAt: Date.now() + expiresIn * 1000,
      })
      scheduleRefresh(expiresIn)
    },
    [scheduleRefresh],
  )

  const logout = useCallback(async (): Promise<void> => {
    // Demo provider has no auth server — just clear local state.
    if (config?.auth.provider === 'demo') {
      clearRefreshTimer()
      setState(null)
      return
    }
    try {
      await fetch(`${getAuthUrl()}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (err) {
      console.error('Logout request failed:', err)
    } finally {
      clearRefreshTimer()
      setState(null)
    }
  }, [clearRefreshTimer, config, getAuthUrl])

  const getToken = useCallback((): string | null => {
    return state?.accessToken ?? null
  }, [state])

  useEffect(() => {
    return () => clearRefreshTimer()
  }, [clearRefreshTimer])

  return (
    <AuthContext.Provider
      value={{
        state,
        login,
        loginAsDemoParty,
        loginFromCallback,
        logout,
        getToken,
        isAuthenticated: state !== null,
        isInitialized,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
