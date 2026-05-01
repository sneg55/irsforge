import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { CsaPageSkeleton } from '../csa-page-skeleton'

afterEach(() => cleanup())

describe('CsaPageSkeleton', () => {
  test('renders skeleton rows for the CSA table', () => {
    const { container } = render(<CsaPageSkeleton />)
    const rows = container.querySelectorAll('tr[data-slot="csa-skeleton-row"]')
    expect(rows.length).toBeGreaterThanOrEqual(3)
  })
})
