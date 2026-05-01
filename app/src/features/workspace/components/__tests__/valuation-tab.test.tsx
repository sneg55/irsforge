import type { ValuationResult } from '@irsforge/shared-pricing'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { ValuationTab } from '../valuation-tab'

afterEach(() => cleanup())

describe('ValuationTab', () => {
  test('renders em-dashes when valuation is null', () => {
    const { container } = render(<ValuationTab valuation={null} />)
    expect(container.textContent).toContain('NET VALUATION')
    expect(container.textContent).toContain('—')
  })

  test('renders npv/parRate/dv01/modDuration/convexity', () => {
    const valuation: ValuationResult = {
      npv: 12345,
      dv01: 678,
      parRate: 0.045,
      modDuration: 4.12,
      convexity: 25.1,
      cashflows: [],
      legPVs: [],
    }
    const { container } = render(<ValuationTab valuation={valuation} />)
    expect(container.textContent).toMatch(/4\.12/)
    expect(container.textContent).toMatch(/25\.1/)
  })

  test('valuation labels carry explanatory title attributes', () => {
    const { container } = render(<ValuationTab valuation={null} />)
    const npv = container.querySelector('[data-tooltip-key="npv"]')
    expect(npv?.getAttribute('title')).toMatch(/discounted/i)
    const parRate = container.querySelector('[data-tooltip-key="par-rate"]')
    expect(parRate?.getAttribute('title')).toMatch(/zero/i)
    const dv01 = container.querySelector('[data-tooltip-key="dv01"]')
    expect(dv01?.getAttribute('title')).toMatch(/1bp/i)
    const modDuration = container.querySelector('[data-tooltip-key="mod-duration"]')
    expect(modDuration?.getAttribute('title')).toMatch(/100bp/i)
    const convexity = container.querySelector('[data-tooltip-key="convexity"]')
    expect(convexity?.getAttribute('title')).toMatch(/curvature/i)
  })
})
