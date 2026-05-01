import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { WorkspacePageSkeleton } from '../page-skeleton'

afterEach(() => cleanup())

describe('WorkspacePageSkeleton', () => {
  test('renders shape-preserving placeholders for top bar, strip, legs, right panel', () => {
    const { container } = render(<WorkspacePageSkeleton />)
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
    // Rough shape: at least a dozen pulse blocks for the composite layout.
    expect(skeletons.length).toBeGreaterThanOrEqual(12)
  })
})
