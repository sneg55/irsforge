import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SwapTableRow, sparklineTooltip } from './swap-table-row'
import type { SwapRow } from './types'

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

afterEach(cleanup)

const baseRow: SwapRow = {
  contractId: 'c1',
  type: 'IRS',
  counterparty: 'JPMorgan',
  notional: 10_000_000,
  currency: 'USD',
  tradeDate: '2026-01-01',
  maturity: '2027-01-01',
  npv: 100,
  dv01: 250,
  status: 'Active',
  direction: 'pay',
  legDetail: 'Fixed 4.25% / SOFR',
  sparkline: [1, 2, 3],
}

function wrap(row: SwapRow) {
  return (
    <table>
      <tbody>
        <SwapTableRow
          row={row}
          activeTab="active"
          isTerminal={false}
          isDrafts={false}
          onClick={() => {}}
          onDeleteDraft={() => {}}
        />
      </tbody>
    </table>
  )
}

describe('SwapTableRow', () => {
  it('renders the leg detail subtitle under the Pay/Receive label', () => {
    const { container } = render(wrap(baseRow))
    expect(container.textContent).toContain('Pay')
    expect(container.textContent).toContain('Fixed 4.25% / SOFR')
  })

  it('renders the trade date column', () => {
    const { container } = render(wrap(baseRow))
    expect(container.textContent).toContain('2026-01-01')
  })

  it('shows MAT SOON badge only when maturingSoon is set on an Active row', () => {
    const soon = render(wrap({ ...baseRow, maturingSoon: true }))
    expect(soon.container.textContent).toContain('MAT SOON')
    cleanup()
    const not = render(wrap({ ...baseRow, maturingSoon: false }))
    expect(not.container.textContent).not.toContain('MAT SOON')
  })

  it('omits MAT SOON for non-Active rows even if maturingSoon is set', () => {
    const { container } = render(wrap({ ...baseRow, status: 'UnwindPending', maturingSoon: true }))
    expect(container.textContent).not.toContain('MAT SOON')
  })

  it('omits the leg-detail subtitle when legDetail is empty', () => {
    const { container } = render(wrap({ ...baseRow, legDetail: '' }))
    expect(container.textContent).not.toContain('Fixed 4.25%')
  })

  it('renders a sparkline tooltip with horizon and range', () => {
    const { container } = render(wrap({ ...baseRow, sparkline: [10, 12, 11, 14, 13] }))
    const title = container.querySelector('svg title')
    expect(title?.textContent).toMatch(/Trend over last 5 curve ticks/)
  })
})

describe('sparklineTooltip', () => {
  it('returns undefined for a single-point or empty series', () => {
    expect(sparklineTooltip([])).toBeUndefined()
    expect(sparklineTooltip([42])).toBeUndefined()
  })

  it('reports horizon length and percent range for a multi-point series', () => {
    const t = sparklineTooltip([100, 110, 90, 105])
    expect(t).toMatch(/Trend over last 4 curve ticks/)
    expect(t).toMatch(/range ±/)
  })
})
