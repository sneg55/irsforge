import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { ReferenceSofrTile } from '../reference-sofr-tile'

const curve = {
  asOf: '2026-04-21T12:00:00Z',
  currency: 'USD',
  curveType: 'Discount' as const,
  pillars: [{ tenorDays: 730, zeroRate: 0.0428, tenorLabel: '2Y' }],
  constructionMetadata: '{}',
  interpolation: 'linear' as const,
  dayCount: 'ACT_360' as const,
}

afterEach(() => cleanup())

describe('ReferenceSofrTile', () => {
  test('renders 2Y bid in tile footer', () => {
    const { container } = render(<ReferenceSofrTile curve={curve as never} history={[]} />)
    expect(container.textContent).toContain('2Y')
  })

  test('click opens popover; Esc dismisses', () => {
    const { container } = render(<ReferenceSofrTile curve={curve as never} history={[]} />)
    fireEvent.click(container.querySelector('[data-testid="sofr-tile"]')!)
    expect(document.querySelector('[data-testid="sofr-popover"]')).not.toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('[data-testid="sofr-popover"]')).toBeNull()
  })
})
