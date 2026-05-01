import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LedgerCidLink } from '../ledger-cid-link'

vi.mock('next/navigation', () => ({
  useParams: () => ({ orgId: 'demo' }),
}))

describe('LedgerCidLink', () => {
  it('renders a truncated cid as an anchor into /ledger?cid=', () => {
    render(<LedgerCidLink cid="00abcdef1234567890" />)
    const link = screen.getByRole('link') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/org/demo/ledger?cid=00abcdef1234567890')
    expect(link.textContent).toMatch(/00abcdef/)
    expect(link.textContent).toContain('…')
  })

  it('renders a full-cid title for hover', () => {
    render(<LedgerCidLink cid="00abcdef1234567890" />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('title')).toBe('00abcdef1234567890')
  })

  it('applies custom prefix label', () => {
    render(<LedgerCidLink cid="00abcdef1234567890" prefixLabel="swap" />)
    expect(screen.getByText(/swap:/)).toBeTruthy()
  })

  it('does not truncate if cid is shorter than truncate', () => {
    render(<LedgerCidLink cid="00ab" truncate={8} />)
    const link = screen.getByRole('link')
    expect(link.textContent).not.toContain('…')
  })
})
