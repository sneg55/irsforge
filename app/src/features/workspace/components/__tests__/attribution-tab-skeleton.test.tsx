import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { AttributionTabSkeleton } from '../attribution-tab'

afterEach(() => cleanup())

describe('AttributionTabSkeleton', () => {
  test('renders a stack of placeholder rows mirroring attribution lines', () => {
    const { container } = render(<AttributionTabSkeleton />)
    const blocks = container.querySelectorAll('[data-slot="skeleton"]')
    expect(blocks.length).toBeGreaterThanOrEqual(6)
  })
})
