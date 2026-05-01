import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import CallbackPage from '../page'

const replaceMock = vi.fn()
const searchParamsState: { params: URLSearchParams } = { params: new URLSearchParams() }
vi.mock('next/navigation', () => ({
  useParams: () => ({ orgId: 'goldman' }),
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParamsState.params,
}))

const auth = { loginFromCallback: vi.fn() }
vi.mock('@/shared/contexts/auth-context', () => ({ useAuth: () => auth }))
const cfg = {
  config: null as null | {
    auth: { provider: string }
    orgs: Array<{ id: string; hint: string }>
  },
}
vi.mock('@/shared/contexts/config-context', () => ({ useConfig: () => cfg }))
vi.mock('@/shared/config/client', () => ({ resolveAuthUrl: () => 'http://auth.test' }))

beforeEach(() => {
  replaceMock.mockReset()
  auth.loginFromCallback.mockReset()
  searchParamsState.params = new URLSearchParams()
})
afterEach(() => cleanup())

describe('CallbackPage', () => {
  test('renders waiting message', () => {
    const { container } = render(<CallbackPage />)
    expect(container.textContent).toContain('Completing')
  })

  test('?error=... redirects to login with error', async () => {
    searchParamsState.params = new URLSearchParams('error=oidc_denied')
    render(<CallbackPage />)
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('/login?error=oidc_denied')),
    )
  })

  test('successful handoff exchanges token and redirects to blotter', async () => {
    searchParamsState.params = new URLSearchParams('handoff=abc')
    cfg.config = {
      auth: { provider: 'builtin' },
      orgs: [
        { id: 'goldman', hint: 'PartyA' },
        { id: 'operator', hint: 'Operator' },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accessToken: 't',
          expiresIn: 3600,
          userId: 'u',
          orgId: 'goldman',
          party: 'PA',
        }),
      }),
    )
    render(<CallbackPage />)
    await waitFor(() => expect(auth.loginFromCallback).toHaveBeenCalled())
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/org/goldman/blotter'))
    vi.unstubAllGlobals()
  })

  test('failed handoff shows error message and redirects to login', async () => {
    searchParamsState.params = new URLSearchParams('handoff=bad')
    cfg.config = {
      auth: { provider: 'builtin' },
      orgs: [
        { id: 'goldman', hint: 'PartyA' },
        { id: 'operator', hint: 'Operator' },
      ],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    const { container } = render(<CallbackPage />)
    await waitFor(() => expect(container.textContent).toContain('Sign-in failed'))
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('error=handoff_failed')),
    )
    vi.unstubAllGlobals()
  })
})
