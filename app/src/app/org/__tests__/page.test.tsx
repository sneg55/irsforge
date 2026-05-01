import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import OrgSelectorPage from '../page'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

const cfg = { loading: false, config: null as unknown }
vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => cfg,
}))
const auth = { isAuthenticated: false, state: null as null | { orgId: string } }
vi.mock('@/shared/contexts/auth-context', () => ({
  useAuth: () => auth,
}))

beforeEach(() => {
  pushMock.mockReset()
  cfg.loading = false
  cfg.config = null
  auth.isAuthenticated = false
  auth.state = null
})
afterEach(() => cleanup())

describe('OrgSelectorPage', () => {
  test('shows loading spinner when config is loading', () => {
    cfg.loading = true
    const { container } = render(<OrgSelectorPage />)
    expect(container.textContent).toContain('Loading')
  })

  test('shows empty message when no orgs configured', () => {
    cfg.config = { orgs: [], auth: { provider: 'builtin' } }
    const { container } = render(<OrgSelectorPage />)
    expect(container.textContent).toContain('No organizations configured')
  })

  test('demo provider shows DEMO banner', () => {
    cfg.config = { orgs: [], auth: { provider: 'demo' } }
    const { container } = render(<OrgSelectorPage />)
    expect(container.textContent).toContain('Demo')
  })

  test('clicking an org not authed routes to /login', () => {
    cfg.config = {
      orgs: [{ id: 'goldman', displayName: 'Goldman', party: 'PA' }],
      auth: { provider: 'demo' },
    }
    const { getByText } = render(<OrgSelectorPage />)
    fireEvent.click(getByText('Goldman'))
    expect(pushMock).toHaveBeenCalledWith('/org/goldman/login')
  })

  test('clicking an org already authed for same orgId routes to /blotter', () => {
    cfg.config = {
      orgs: [{ id: 'goldman', displayName: 'Goldman', party: 'PA' }],
      auth: { provider: 'demo' },
    }
    auth.isAuthenticated = true
    auth.state = { orgId: 'goldman' }
    const { getByText } = render(<OrgSelectorPage />)
    fireEvent.click(getByText('Goldman'))
    expect(pushMock).toHaveBeenCalledWith('/org/goldman/blotter')
  })
})
