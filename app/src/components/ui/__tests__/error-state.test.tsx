import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ErrorState } from '../error-state'

afterEach(() => cleanup())

describe('ErrorState', () => {
  test('renders the provided message', () => {
    const { getByText } = render(<ErrorState error={new Error('boom')} onRetry={() => {}} />)
    expect(getByText('boom')).toBeTruthy()
  })

  test('renders a generic fallback when error has no message', () => {
    const { getByText } = render(<ErrorState error={null} onRetry={() => {}} />)
    expect(getByText(/something went wrong/i)).toBeTruthy()
  })

  test('invokes onRetry when the button is clicked', () => {
    const retry = vi.fn()
    const { getByRole } = render(<ErrorState error={new Error('x')} onRetry={retry} />)
    fireEvent.click(getByRole('button', { name: /retry/i }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  test('accepts a custom label for the action', () => {
    const { getByRole } = render(
      <ErrorState error={new Error('x')} onRetry={() => {}} retryLabel="Reconnect" />,
    )
    expect(getByRole('button', { name: 'Reconnect' })).toBeTruthy()
  })
})
