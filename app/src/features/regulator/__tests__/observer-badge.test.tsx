import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ObserverBadge } from '../components/observer-badge'

const mockUseRole = vi.fn()
vi.mock('@/shared/hooks/use-active-org-role', () => ({
  useActiveOrgRole: () => mockUseRole(),
}))

describe('ObserverBadge', () => {
  it('renders OBSERVER label when role is regulator', () => {
    mockUseRole.mockReturnValue('regulator')
    render(<ObserverBadge />)
    expect(screen.queryByText('OBSERVER')).not.toBe(null)
  })

  it('renders nothing for trader role', () => {
    mockUseRole.mockReturnValue('trader')
    const { container } = render(<ObserverBadge />)
    expect(container.firstChild).toBe(null)
  })

  it('renders nothing for operator role', () => {
    mockUseRole.mockReturnValue('operator')
    const { container } = render(<ObserverBadge />)
    expect(container.firstChild).toBe(null)
  })
})
