import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import Home from '../page'

const replaceMock = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: replaceMock }) }))

afterEach(() => {
  cleanup()
  replaceMock.mockReset()
})

describe('Home root page', () => {
  test('redirects to /org on mount', () => {
    render(<Home />)
    expect(replaceMock).toHaveBeenCalledWith('/org')
  })

  test('renders Loading text while waiting', () => {
    const { container } = render(<Home />)
    expect(container.textContent).toContain('Loading')
  })
})
