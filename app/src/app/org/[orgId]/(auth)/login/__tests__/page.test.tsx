import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ClientConfig } from '@/shared/config/client'

import LoginPage from '../page'

const replaceMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useParams: () => ({ orgId: 'goldman' }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const authState = {
  login: vi.fn(),
  loginAsDemoParty: vi.fn(),
  isAuthenticated: false,
  isInitialized: true,
  state: null as null | { orgId: string },
}
vi.mock('@/shared/contexts/auth-context', () => ({
  useAuth: () => authState,
}))

const configState: { config: ClientConfig | null; loading: boolean } = {
  config: null,
  loading: false,
}
vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => configState,
}))

vi.mock('@/shared/config/client', () => ({
  resolveAuthUrl: () => 'http://auth.test',
}))

function makeConfig(provider: 'demo' | 'builtin' | 'oidc'): ClientConfig {
  return {
    topology: 'sandbox',
    routing: 'path',
    auth:
      provider === 'oidc'
        ? { provider, oidc: { clientId: 'x', issuer: 'y' } as never }
        : { provider },
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
}

beforeEach(() => {
  replaceMock.mockReset()
  authState.login.mockReset()
  authState.loginAsDemoParty.mockReset()
  authState.isAuthenticated = false
  authState.isInitialized = true
  authState.state = null
  configState.loading = false
  configState.config = null
})
afterEach(() => cleanup())

describe('LoginPage', () => {
  test('renders loading when config not ready', () => {
    configState.loading = true
    const { container } = render(<LoginPage />)
    expect(container.textContent).toMatch(/Loading/)
  })

  test('renders unknown org when orgId missing from config', () => {
    configState.config = { ...makeConfig('demo'), orgs: [] }
    const { container } = render(<LoginPage />)
    expect(container.textContent).toMatch(/Unknown organization/)
  })

  test('demo provider renders demo button and calls loginAsDemoParty', async () => {
    configState.config = makeConfig('demo')
    authState.loginAsDemoParty.mockResolvedValue(undefined)
    const { container } = render(<LoginPage />)
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Log in as'),
    )!
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(authState.loginAsDemoParty).toHaveBeenCalledWith('goldman')
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/org/goldman/blotter'))
  })

  test('demo login shows error when loginAsDemoParty throws', async () => {
    configState.config = makeConfig('demo')
    authState.loginAsDemoParty.mockRejectedValue(new Error('nope'))
    const { container } = render(<LoginPage />)
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Log in as'),
    )!
    await act(async () => {
      fireEvent.click(btn)
    })
    await waitFor(() => expect(container.textContent).toMatch(/nope/))
  })

  test('oidc provider renders SSO link', () => {
    configState.config = makeConfig('oidc')
    const { container } = render(<LoginPage />)
    const a = container.querySelector('a[href*="/auth/authorize"]') as HTMLAnchorElement
    expect(a).not.toBeNull()
    expect(a.textContent).toMatch(/Sign in with SSO/)
  })

  test('builtin provider submits form and calls login', async () => {
    configState.config = makeConfig('builtin')
    authState.login.mockResolvedValue(undefined)
    const { container } = render(<LoginPage />)
    const user = container.querySelector('#username') as HTMLInputElement
    const pw = container.querySelector('#password') as HTMLInputElement
    fireEvent.change(user, { target: { value: 'u' } })
    fireEvent.change(pw, { target: { value: 'p' } })
    const form = container.querySelector('form')!
    await act(async () => {
      fireEvent.submit(form)
    })
    expect(authState.login).toHaveBeenCalledWith('u', 'p', 'goldman')
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/org/goldman/blotter'))
  })

  test('builtin form surfaces login error', async () => {
    configState.config = makeConfig('builtin')
    authState.login.mockRejectedValue(new Error('bad creds'))
    const { container } = render(<LoginPage />)
    fireEvent.change(container.querySelector('#username') as HTMLInputElement, {
      target: { value: 'u' },
    })
    fireEvent.change(container.querySelector('#password') as HTMLInputElement, {
      target: { value: 'p' },
    })
    await act(async () => {
      fireEvent.submit(container.querySelector('form')!)
    })
    await waitFor(() => expect(container.textContent).toMatch(/bad creds/))
  })

  test('already authenticated for this org redirects to blotter', async () => {
    configState.config = makeConfig('demo')
    authState.isAuthenticated = true
    authState.state = { orgId: 'goldman' }
    render(<LoginPage />)
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/org/goldman/blotter'))
  })

  test('authed for different org (demo) re-mints then redirects', async () => {
    configState.config = makeConfig('demo')
    authState.isAuthenticated = true
    authState.state = { orgId: 'other' }
    authState.loginAsDemoParty.mockResolvedValue(undefined)
    render(<LoginPage />)
    await waitFor(() => expect(authState.loginAsDemoParty).toHaveBeenCalledWith('goldman'))
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/org/goldman/blotter'))
  })
})
