import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ClientConfig, setClientConfig } from '../../config/client'
import { AuthProvider, useAuth } from '../auth-context'
import { ConfigProvider, useConfig } from '../config-context'

vi.mock('../../ledger/parties', () => ({
  generatePartyToken: vi.fn().mockResolvedValue('eyJ.stub.tok'),
  demoActAsReadAs: (hint: string) => ({
    actAs: [hint, 'Operator'],
    readAs: ['Regulator'],
  }),
}))

function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider>
      <AuthProvider>{children}</AuthProvider>
    </ConfigProvider>
  )
}

function useAuthAndConfig() {
  const auth = useAuth()
  const { config } = useConfig()
  return { ...auth, configReady: config !== null }
}

const BUILTIN: ClientConfig = {
  topology: 'sandbox',
  routing: 'path',
  authBaseUrl: 'http://auth.test',
  auth: { provider: 'builtin', builtin: { issuer: 'http://auth.test' } },
  daml: { ledgerId: 's', applicationId: 'a', unsafeJwtSecret: 'k' },
  orgs: [
    {
      id: 'goldman',
      party: 'PartyA',
      displayName: 'Goldman',
      hint: 'PartyA',
      role: 'trader',
      ledgerUrl: 'http://x',
    },
  ],
}

const DEMO: ClientConfig = { ...BUILTIN, auth: { provider: 'demo' } }

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('auth-context — builtin login branch', () => {
  it('calls POST /auth/login and populates state on success', async () => {
    setClientConfig(BUILTIN)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: 'jwt-abc',
        userId: 'u1',
        orgId: 'goldman',
        party: 'PartyA',
        expiresIn: 3600,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.configReady).toBe(true))

    await act(async () => {
      await result.current.login('user', 'pw', 'goldman')
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
    expect(result.current.state?.accessToken).toBe('jwt-abc')
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.getToken()).toBe('jwt-abc')
  })

  it('throws when login response is not ok', async () => {
    setClientConfig(BUILTIN)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'bad creds',
      }),
    )

    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.configReady).toBe(true))

    await expect(result.current.login('u', 'p', 'goldman')).rejects.toThrow(/Login failed.*401/)
  })
})

describe('auth-context — logout with real provider', () => {
  it('builtin logout hits /auth/logout and clears state on success', async () => {
    setClientConfig(BUILTIN)
    const fetchMock = vi
      .fn()
      // login
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'tok',
          userId: 'u',
          orgId: 'goldman',
          party: 'PartyA',
          expiresIn: 3600,
        }),
      })
      // logout
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.configReady).toBe(true))
    await act(async () => {
      await result.current.login('u', 'p', 'goldman')
    })
    expect(result.current.isAuthenticated).toBe(true)

    await act(async () => {
      await result.current.logout()
    })
    expect(result.current.state).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('builtin logout tolerates fetch rejection and still clears state', async () => {
    setClientConfig(BUILTIN)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'tok',
          userId: 'u',
          orgId: 'goldman',
          party: 'PartyA',
          expiresIn: 3600,
        }),
      })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.configReady).toBe(true))
    await act(async () => {
      await result.current.login('u', 'p', 'goldman')
    })
    await act(async () => {
      await result.current.logout()
    })
    expect(result.current.state).toBeNull()
  })
})

describe('auth-context — loginFromCallback + getToken', () => {
  it('loginFromCallback seeds state directly, getToken returns current token', async () => {
    setClientConfig(DEMO)
    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.configReady).toBe(true))

    expect(result.current.getToken()).toBeNull()

    act(() => {
      result.current.loginFromCallback('callback-jwt', 3600, 'u-2', 'goldman', 'PartyA')
    })

    expect(result.current.state?.accessToken).toBe('callback-jwt')
    expect(result.current.state?.userId).toBe('u-2')
    expect(result.current.state?.party).toBe('PartyA')
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.getToken()).toBe('callback-jwt')
  })
})

describe('auth-context — mount restore for non-demo', () => {
  it('restores a session by calling /auth/refresh when meta is present', async () => {
    setClientConfig(BUILTIN)
    // Prime meta before mount so the restore effect picks it up.
    window.localStorage.setItem(
      'irsforge:auth-meta',
      JSON.stringify({ userId: 'u', orgId: 'goldman', party: 'PartyA' }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accessToken: 'refreshed',
          userId: 'u',
          orgId: 'goldman',
          party: 'PartyA',
          expiresIn: 3600,
        }),
      }),
    )

    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    expect(result.current.state?.accessToken).toBe('refreshed')
  })

  it('drops stale meta when /auth/refresh returns non-ok', async () => {
    setClientConfig(BUILTIN)
    window.localStorage.setItem(
      'irsforge:auth-meta',
      JSON.stringify({ userId: 'u', orgId: 'goldman', party: 'PartyA' }),
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))

    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false))
    await waitFor(() => {
      expect(window.localStorage.getItem('irsforge:auth-meta')).toBeNull()
    })
  })
})
