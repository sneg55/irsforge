import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { RegulatorVisibilityPill } from '../regulator-visibility-pill'

afterEach(() => cleanup())

describe('RegulatorVisibilityPill', () => {
  test('renders pill when regulators list is non-empty', () => {
    render(<RegulatorVisibilityPill regulators={['Regulator::abc']} />)
    expect(screen.getByText(/regulator visible/i)).toBeTruthy()
  })

  test('renders nothing when regulators is empty', () => {
    const { container } = render(<RegulatorVisibilityPill regulators={[]} />)
    expect(container.firstChild).toBeNull()
  })

  test('shows count when more than one regulator', () => {
    render(<RegulatorVisibilityPill regulators={['Regulator::a', 'Regulator::b']} />)
    expect(screen.getByText(/regulator visible · 2/i)).toBeTruthy()
  })
})
