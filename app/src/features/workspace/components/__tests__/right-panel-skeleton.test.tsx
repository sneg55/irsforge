import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { RightPanelSkeleton } from '../right-panel'

afterEach(() => cleanup())

describe('RightPanelSkeleton', () => {
  test('renders several shape-preserving placeholder blocks', () => {
    const { container } = render(<RightPanelSkeleton />)
    const blocks = container.querySelectorAll('[data-slot="skeleton"]')
    expect(blocks.length).toBeGreaterThanOrEqual(6)
  })
})
