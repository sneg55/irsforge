import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { AuthHeader } from '../auth-header'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))
const auth = {
  state: null as null | {
    userId: string
    orgId: string
    party: string
    accessToken: string
    expiresAt: number
  },
  logout: vi.fn().mockResolvedValue(undefined),
}
vi.mock('../../contexts/auth-context', () => ({ useAuth: () => auth }))
const cfg = { getOrg: vi.fn() }
vi.mock('../../contexts/config-context', () => ({ useConfig: () => cfg }))
const role = 'trader'
vi.mock('@/shared/hooks/use-active-org-role', () => ({ useActiveOrgRole: () => role }))

beforeEach(() => {
  pushMock.mockReset()
  auth.logout.mockReset().mockResolvedValue(undefined)
  cfg.getOrg.mockReset()
})
afterEach(() => cleanup())

describe('AuthHeader', () => {
  test('renders org displayName and userId when available', () => {
    cfg.getOrg.mockReturnValue({ displayName: 'Goldman Sachs', id: 'goldman' })
    auth.state = { userId: 'alice', orgId: 'goldman', party: 'PA', accessToken: 't', expiresAt: 0 }
    const { container } = render(<AuthHeader orgId="goldman" />)
    expect(container.textContent).toContain('Goldman Sachs')
    expect(container.textContent).toContain('alice')
  })

  test('falls back to orgId when getOrg returns undefined', () => {
    cfg.getOrg.mockReturnValue(undefined)
    auth.state = null
    const { container } = render(<AuthHeader orgId="myorg" />)
    expect(container.textContent).toContain('myorg')
  })

  test('strips "demo:" prefix from userId before rendering', () => {
    cfg.getOrg.mockReturnValue({ displayName: 'Goldman Sachs', id: 'goldman' })
    auth.state = {
      userId: 'demo:PartyA',
      orgId: 'goldman',
      party: 'PA',
      accessToken: 't',
      expiresAt: 0,
    }
    const { container } = render(<AuthHeader orgId="goldman" />)
    expect(container.textContent).not.toContain('demo:PartyA')
    expect(container.textContent).toContain('PartyA')
  })

  test('Logout button invokes logout() then navigates to /org', async () => {
    cfg.getOrg.mockReturnValue({ displayName: 'Goldman', id: 'goldman' })
    auth.state = null
    const { getByText } = render(<AuthHeader orgId="goldman" />)
    fireEvent.click(getByText('Logout'))
    await waitFor(() => expect(auth.logout).toHaveBeenCalled())
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/org'))
  })
})
