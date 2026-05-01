import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ClientConfig, setClientConfig } from '../config/client'
import { generatePartyToken } from '../ledger/parties'
import { AuthProvider, useAuth } from './auth-context'
import { ConfigProvider, useConfig } from './config-context'

vi.mock('../ledger/parties', () => ({
  generatePartyToken: vi.fn().mockResolvedValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub.stub'),
  demoActAsReadAs: (orgHint: string) => ({
    actAs: orgHint === 'Operator' ? ['Operator'] : [orgHint, 'Operator'],
    readAs: orgHint === 'Regulator' ? [] : ['Regulator'],
  }),
}))

function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider>
      <AuthProvider>{children}</AuthProvider>
    </ConfigProvider>
  )
}

/** Combined hook so we can wait for config to be available before acting */
function useAuthAndConfig() {
  const auth = useAuth()
  const { config } = useConfig()
  return { ...auth, configReady: config !== null }
}

const CONFIG: ClientConfig = {
  topology: 'sandbox',
  routing: 'path',
  auth: { provider: 'demo' },
  daml: { ledgerId: 'sandbox', applicationId: 'IRSForge', unsafeJwtSecret: 'secret' },
  orgs: [
    {
      id: 'goldman',
      party: 'PartyA',
      displayName: 'Goldman',
      hint: 'PartyA',
      role: 'trader',
      ledgerUrl: 'http://localhost:7575',
    },
    {
      id: 'jpmorgan',
      party: 'PartyB',
      displayName: 'JPM',
      hint: 'PartyB',
      role: 'trader',
      ledgerUrl: 'http://localhost:7575',
    },
  ],
}

describe('loginAsDemoParty', () => {
  beforeEach(() => {
    setClientConfig(CONFIG)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('populates AuthState with token, orgId, party, userId', async () => {
    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })

    await waitFor(() => expect(result.current.configReady).toBe(true))
    await act(async () => {
      await result.current.loginAsDemoParty('goldman')
    })

    expect(result.current.state).not.toBeNull()
    expect(result.current.state?.orgId).toBe('goldman')
    expect(result.current.state?.party).toBe('PartyA')
    expect(result.current.state?.userId).toBe('demo:PartyA')
    expect(result.current.state?.accessToken).toMatch(/^eyJ/)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('passes widened actAs/readAs to generatePartyToken', async () => {
    vi.mocked(generatePartyToken).mockClear()
    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.configReady).toBe(true))
    await act(async () => {
      await result.current.loginAsDemoParty('goldman')
    })

    // Widened demo JWT: actAs includes Operator, readAs includes Regulator.
    // Exact arrays come from the demoActAsReadAs mock factory above.
    expect(generatePartyToken).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining(['PartyA', 'Operator']),
      expect.arrayContaining(['Regulator']),
    )
  })

  it('throws on unknown orgId', async () => {
    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.configReady).toBe(true))

    await expect(result.current.loginAsDemoParty('nonexistent')).rejects.toThrow(/Unknown org/)
  })

  it('logout clears demo state without network error', async () => {
    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.configReady).toBe(true))

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    await act(async () => {
      await result.current.loginAsDemoParty('goldman')
    })
    expect(result.current.isAuthenticated).toBe(true)

    await act(async () => {
      await result.current.logout()
    })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.state).toBeNull()
  })
})

describe('persistence', () => {
  beforeEach(() => {
    setClientConfig(CONFIG)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes only non-secret identity meta to localStorage (no accessToken, no expiresAt)', async () => {
    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.configReady).toBe(true))
    await act(async () => {
      await result.current.loginAsDemoParty('goldman')
    })

    await waitFor(() => {
      expect(window.localStorage.getItem('irsforge:auth-meta')).not.toBeNull()
    })

    const stored = JSON.parse(window.localStorage.getItem('irsforge:auth-meta')!)
    expect(stored).toEqual({
      userId: 'demo:PartyA',
      orgId: 'goldman',
      party: 'PartyA',
    })
    // The JWT and its expiry must never appear in persisted storage.
    expect(stored.accessToken).toBeUndefined()
    expect(stored.expiresAt).toBeUndefined()
    // And the legacy key (which used to hold the whole AuthState inc. JWT)
    // must be absent.
    expect(window.localStorage.getItem('irsforge:auth')).toBeNull()
  })

  it('restores demo session on fresh mount by reminting the token from meta', async () => {
    const first = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(first.result.current.configReady).toBe(true))
    await act(async () => {
      await first.result.current.loginAsDemoParty('goldman')
    })
    await waitFor(() => {
      expect(window.localStorage.getItem('irsforge:auth-meta')).not.toBeNull()
    })

    // Simulate full-page navigation.
    first.unmount()
    const second = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(second.result.current.isAuthenticated).toBe(true))
    expect(second.result.current.state?.orgId).toBe('goldman')
    expect(second.result.current.state?.party).toBe('PartyA')
    // Token was reminted client-side, not read from storage.
    expect(second.result.current.state?.accessToken).toMatch(/^eyJ/)
  })

  it('purges any legacy irsforge:auth blob on mount (defense against JWT-in-storage regression)', async () => {
    window.localStorage.setItem(
      'irsforge:auth',
      JSON.stringify({
        accessToken: 'leaked-jwt',
        userId: 'demo:PartyA',
        orgId: 'goldman',
        party: 'PartyA',
        expiresAt: Date.now() + 60_000,
      }),
    )
    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.configReady).toBe(true))
    expect(window.localStorage.getItem('irsforge:auth')).toBeNull()
  })

  it('clears auth-meta on logout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const { result } = renderHook(() => useAuthAndConfig(), { wrapper: Providers })
    await waitFor(() => expect(result.current.configReady).toBe(true))
    await act(async () => {
      await result.current.loginAsDemoParty('goldman')
    })
    await waitFor(() => {
      expect(window.localStorage.getItem('irsforge:auth-meta')).not.toBeNull()
    })

    await act(async () => {
      await result.current.logout()
    })
    expect(window.localStorage.getItem('irsforge:auth-meta')).toBeNull()
  })
})
