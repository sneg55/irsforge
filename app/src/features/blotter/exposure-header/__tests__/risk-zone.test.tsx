import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RiskZone } from '../risk-zone'

afterEach(cleanup)

describe('RiskZone', () => {
  it('renders compact NPV in green when positive', () => {
    const { container } = render(<RiskZone npv={19_800_000} dv01={-23_400} />)
    const npvEl = container.querySelector('[data-testid="npv-value"]')
    expect(npvEl).not.toBeNull()
    expect(npvEl!.textContent).toBe('$19.8M')
    expect(npvEl!.className).toContain('text-[#22c55e]')
  })

  it('renders compact NPV in red when negative', () => {
    const { container } = render(<RiskZone npv={-5_000_000} dv01={0} />)
    const npvEl = container.querySelector('[data-testid="npv-value"]')
    expect(npvEl!.textContent).toBe('-$5M')
    expect(npvEl!.className).toContain('text-[#ef4444]')
  })

  it('renders DV01 sign-coloured', () => {
    const { container } = render(<RiskZone npv={0} dv01={-23_400} />)
    const dv01El = container.querySelector('[data-testid="dv01-value"]')
    expect(dv01El!.textContent).toBe('-$23.4K')
    expect(dv01El!.className).toContain('text-[#ef4444]')
  })

  it('exposes a full-value tooltip on NPV via title attribute', () => {
    const { container } = render(<RiskZone npv={19_800_000} dv01={0} />)
    const npvEl = container.querySelector('[data-testid="npv-value"]')
    expect(npvEl!.getAttribute('title')).toBe('$19,800,000')
  })

  it('renders both tiles even when both zero', () => {
    const { container } = render(<RiskZone npv={0} dv01={0} />)
    expect(container.querySelector('[data-testid="npv-value"]')!.textContent).toBe('$0')
    expect(container.querySelector('[data-testid="dv01-value"]')!.textContent).toBe('$0')
  })

  it('renders the curve as-of timestamp formatted in UTC', () => {
    const { container } = render(<RiskZone npv={0} dv01={0} asOf="2026-04-27T13:45:09.123Z" />)
    const asOf = container.querySelector('[data-testid="risk-asof"]')
    expect(asOf?.textContent).toBe('as of 13:45:09 UTC')
    expect(asOf?.getAttribute('title')).toBe('2026-04-27T13:45:09.123Z')
  })

  it('renders an em-dash placeholder when asOf is missing', () => {
    const { container } = render(<RiskZone npv={0} dv01={0} asOf={null} />)
    expect(container.querySelector('[data-testid="risk-asof"]')?.textContent).toBe('as of —')
  })
})
