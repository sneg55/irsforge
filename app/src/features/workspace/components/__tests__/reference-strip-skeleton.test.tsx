import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { ReferenceSofrTileSkeleton } from '../reference-sofr-tile'
import { ReferenceStripSkeleton } from '../reference-strip'

afterEach(() => cleanup())

describe('ReferenceStripSkeleton', () => {
  test('renders two placeholder tiles side by side', () => {
    const { container } = render(<ReferenceStripSkeleton />)
    const blocks = container.querySelectorAll('[data-slot="skeleton"]')
    expect(blocks.length).toBeGreaterThanOrEqual(6) // ~3 lines per tile × 2 tiles
  })
})

describe('ReferenceSofrTileSkeleton', () => {
  test('renders label + value + caption placeholders', () => {
    const { container } = render(<ReferenceSofrTileSkeleton />)
    const blocks = container.querySelectorAll('[data-slot="skeleton"]')
    expect(blocks.length).toBeGreaterThanOrEqual(3)
  })
})
