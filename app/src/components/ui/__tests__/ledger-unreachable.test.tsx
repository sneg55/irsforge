import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { LedgerUnreachable } from '../ledger-unreachable'

describe('LedgerUnreachable', () => {
  test('renders the default copy when no message is supplied', () => {
    render(<LedgerUnreachable />)
    expect(screen.getByTestId('ledger-unreachable').textContent).toContain(
      'Cannot reach the Canton ledger',
    )
    expect(screen.getByTestId('ledger-unreachable').textContent).toContain(
      'The ledger is temporarily unreachable.',
    )
  })

  test('renders a caller-supplied message in addition to the headline', () => {
    render(<LedgerUnreachable message="Your swap blotter is unavailable." />)
    const node = screen.getByTestId('ledger-unreachable')
    expect(node.textContent).toContain('Cannot reach the Canton ledger')
    expect(node.textContent).toContain('Your swap blotter is unavailable.')
  })

  test('exposes a polite live region for screen readers', () => {
    render(<LedgerUnreachable />)
    const node = screen.getByTestId('ledger-unreachable')
    expect(node.getAttribute('role')).toBe('status')
    expect(node.getAttribute('aria-live')).toBe('polite')
  })

  test('appends caller className alongside the built-in chrome', () => {
    render(<LedgerUnreachable className="mt-12" />)
    const node = screen.getByTestId('ledger-unreachable')
    expect(node.className).toContain('mt-12')
    expect(node.className).toContain('border-amber-900/50')
  })
})
