import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { VolumeZone } from '../volume-zone'

afterEach(cleanup)

describe('VolumeZone', () => {
  it('renders notional and trade count', () => {
    const { container } = render(
      <VolumeZone
        notional={60_000_000}
        activeSwaps={3}
        swapCountByType={{ IRS: 1, OIS: 1, BASIS: 1 }}
      />,
    )
    const notional = container.querySelector('[data-testid="notional-value"]')
    const trades = container.querySelector('[data-testid="trades-value"]')
    expect(notional!.textContent).toBe('$60M')
    expect(trades!.textContent).toBe('3')
  })

  it('renders type chips in IRS/OIS/BASIS/XCCY/CDS order', () => {
    const { container } = render(
      <VolumeZone notional={0} activeSwaps={3} swapCountByType={{ CDS: 1, BASIS: 1, IRS: 1 }} />,
    )
    const chips = Array.from(container.querySelectorAll('[data-testid="type-chip"]'))
    expect(chips.map((c) => c.textContent)).toEqual(['IRS · 1', 'BASIS · 1', 'CDS · 1'])
  })

  it('omits chips with zero count', () => {
    const { container } = render(
      <VolumeZone notional={0} activeSwaps={1} swapCountByType={{ IRS: 1, OIS: 0 }} />,
    )
    const chips = Array.from(container.querySelectorAll('[data-testid="type-chip"]'))
    expect(chips.map((c) => c.textContent)).toEqual(['IRS · 1'])
  })

  it('renders unknown types after known ones', () => {
    const { container } = render(
      <VolumeZone notional={0} activeSwaps={2} swapCountByType={{ FpML: 1, OIS: 1 }} />,
    )
    const chips = Array.from(container.querySelectorAll('[data-testid="type-chip"]'))
    expect(chips.map((c) => c.textContent)).toEqual(['OIS · 1', 'FpML · 1'])
  })

  it('renders no chips when no types have counts', () => {
    const { container } = render(<VolumeZone notional={0} activeSwaps={0} swapCountByType={{}} />)
    const chips = Array.from(container.querySelectorAll('[data-testid="type-chip"]'))
    expect(chips).toHaveLength(0)
  })

  it('renders the curve as-of timestamp formatted in UTC', () => {
    const { container } = render(
      <VolumeZone
        notional={0}
        activeSwaps={0}
        swapCountByType={{}}
        asOf="2026-04-27T13:45:09.123Z"
      />,
    )
    const asOf = container.querySelector('[data-testid="volume-asof"]')
    expect(asOf?.textContent).toBe('as of 13:45:09 UTC')
  })

  it('renders an em-dash placeholder when asOf is missing', () => {
    const { container } = render(
      <VolumeZone notional={0} activeSwaps={0} swapCountByType={{}} asOf={null} />,
    )
    expect(container.querySelector('[data-testid="volume-asof"]')?.textContent).toBe('as of —')
  })
})
