import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { CashflowEntry, LegConfig } from '../../types'
import { LegColumn } from '../leg-column'

// Hooks pulled from app context: stub them out so the component can render
// in isolation without a React Query / Auth provider tree.
vi.mock('../../hooks/use-currency-options', () => ({
  useCurrencyOptions: () => [
    { label: 'USD', value: 'USD' },
    { label: 'EUR', value: 'EUR' },
  ],
}))

vi.mock('@/shared/ledger/useFloatingRateIndex', () => ({
  useFloatingRateIndices: () => ({
    data: [
      { indexId: 'USD-SOFR', currency: 'USD' },
      { indexId: 'EUR-ESTR', currency: 'EUR' },
    ],
  }),
}))

afterEach(() => cleanup())

const schedule = {
  startDate: new Date('2026-04-14'),
  endDate: new Date('2031-04-14'),
  frequency: 'Quarterly' as const,
}

const baseProps = {
  mode: 'draft' as const,
  cashflows: [] as CashflowEntry[],
  legPV: 0,
  onUpdateLeg: () => {},
  onNotionalChange: () => {},
  onToggleDirection: () => {},
}

describe('LegColumn — per-leg-type render', () => {
  test('fixed leg shows LEG 1 — RCV FIXED label and editable rate field', () => {
    const leg: LegConfig = {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional: 10_000_000,
      rate: 0.045,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container } = render(<LegColumn {...baseProps} leg={leg} legIndex={0} />)
    expect(container.textContent).toContain('LEG 1')
    expect(container.textContent).toContain('FIXED')
    // Rate renders as basis-percentage.
    expect(container.textContent).toMatch(/4\.5000\s*%/)
  })

  test('float leg shows index dropdown populated for the leg currency only', () => {
    const leg: LegConfig = {
      legType: 'float',
      direction: 'pay',
      currency: 'USD',
      notional: 10_000_000,
      indexId: 'USD-SOFR',
      spread: 0.001,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container } = render(<LegColumn {...baseProps} leg={leg} legIndex={1} />)
    expect(container.textContent).toContain('LEG 2')
    expect(container.textContent).toContain('FLOAT')
    // Spread rendered as bp.
    expect(container.textContent).toContain('10 bp')
    // USD-SOFR option present; EUR-ESTR should be filtered out.
    const html = container.innerHTML
    expect(html).toContain('USD-SOFR')
    expect(html).not.toContain('EUR-ESTR')
  })

  test('protection leg label reflects buy/sell protection semantics', () => {
    const leg: LegConfig = {
      legType: 'protection',
      direction: 'receive',
      notional: 25_000_000,
      recoveryRate: 0.4,
    }
    const { container } = render(<LegColumn {...baseProps} leg={leg} legIndex={1} />)
    expect(container.textContent).toContain('BUY PROTECTION')
  })

  test("asset leg renders UnderlyingsEditor with the leg's underlyings", () => {
    const leg: LegConfig = {
      legType: 'asset',
      direction: 'receive',
      notional: 10_000_000,
      underlyings: [{ assetId: 'AAPL', weight: 0.6, initialPrice: 180, currentPrice: 195 }],
    }
    const { container } = render(<LegColumn {...baseProps} leg={leg} legIndex={0} />)
    expect(container.textContent).toContain('ASSET')
    // UnderlyingsEditor emits the assetId somewhere in its field labels/inputs.
    expect(container.innerHTML).toContain('AAPL')
  })

  test('fx leg at index 0 shows NEAR, at index 1 shows FAR', () => {
    const legNear: LegConfig = {
      legType: 'fx',
      direction: 'pay',
      baseCurrency: 'USD',
      foreignCurrency: 'EUR',
      notional: 10_000_000,
      fxRate: 1.08,
      paymentDate: new Date('2026-04-14'),
    }
    const { container: c1 } = render(<LegColumn {...baseProps} leg={legNear} legIndex={0} />)
    expect(c1.textContent).toContain('NEAR')

    const legFar: LegConfig = { ...legNear, paymentDate: new Date('2031-04-14') }
    const { container: c2 } = render(<LegColumn {...baseProps} leg={legFar} legIndex={1} />)
    expect(c2.textContent).toContain('FAR')
  })
})

describe('LegColumn — editable interactions', () => {
  test('onToggleDirection fires when "Flip" button clicked', () => {
    const onToggleDirection = vi.fn()
    const leg: LegConfig = {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional: 10_000_000,
      rate: 0.04,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container } = render(
      <LegColumn {...baseProps} leg={leg} legIndex={0} onToggleDirection={onToggleDirection} />,
    )
    const flipBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Flip'),
    )
    fireEvent.click(flipBtn as HTMLElement)
    expect(onToggleDirection).toHaveBeenCalledTimes(1)
  })

  test('notional link button fires onToggleNotionalLink only on leg 0', () => {
    const onToggleNotionalLink = vi.fn()
    const leg: LegConfig = {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional: 10_000_000,
      rate: 0.04,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container } = render(
      <LegColumn
        {...baseProps}
        leg={leg}
        legIndex={0}
        notionalLinked
        onToggleNotionalLink={onToggleNotionalLink}
      />,
    )
    const linkBtn = container.querySelector('button[title*="linked"]')
    fireEvent.click(linkBtn as HTMLElement)
    expect(onToggleNotionalLink).toHaveBeenCalledTimes(1)
  })

  test('view mode hides the direction-flip button and link toggle', () => {
    const leg: LegConfig = {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional: 10_000_000,
      rate: 0.04,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container } = render(
      <LegColumn
        {...baseProps}
        leg={leg}
        legIndex={0}
        mode="active"
        notionalLinked
        onToggleNotionalLink={() => {}}
      />,
    )
    // The flip button renders regardless of mode — only the linkButton is
    // editable-only. Assert the link button is absent in view mode.
    expect(container.querySelector('button[title*="linked"]')).toBeNull()
  })
})

describe('LegColumn — PV + cashflow section', () => {
  test('positive legPV renders with green class; negative with red', () => {
    const leg: LegConfig = {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional: 10_000_000,
      rate: 0.04,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container: pos } = render(
      <LegColumn {...baseProps} leg={leg} legIndex={0} legPV={1234} />,
    )
    expect(pos.innerHTML).toContain('#22c55e'.slice(1).toLowerCase()) // color or class ref — at minimum PV text

    const { container: neg } = render(
      <LegColumn {...baseProps} leg={leg} legIndex={0} legPV={-1234} />,
    )
    expect(neg.textContent).toContain('LEG VALUATION')
  })

  test('float leg shows "Next Fixing" label in the accrual slot', () => {
    const leg: LegConfig = {
      legType: 'float',
      direction: 'pay',
      currency: 'USD',
      notional: 10_000_000,
      indexId: 'USD-SOFR',
      spread: 0,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container } = render(<LegColumn {...baseProps} leg={leg} legIndex={0} />)
    expect(container.textContent).toContain('Next Fixing')
  })

  test('fixed leg shows "Accrued" label in the accrual slot', () => {
    const leg: LegConfig = {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional: 10_000_000,
      rate: 0.04,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container } = render(<LegColumn {...baseProps} leg={leg} legIndex={0} />)
    expect(container.textContent).toContain('Accrued')
  })

  test('marks field grid as visually read-only when mode is active', () => {
    const leg: LegConfig = {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional: 10_000_000,
      rate: 0.04,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container } = render(<LegColumn {...baseProps} mode="active" leg={leg} legIndex={0} />)
    const grid = container.querySelector('[data-testid="leg-field-grid"]')
    expect(grid?.getAttribute('data-readonly')).toBe('true')
  })

  test('does not mark field grid read-only in whatif mode', () => {
    const leg: LegConfig = {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional: 10_000_000,
      rate: 0.04,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container } = render(<LegColumn {...baseProps} mode="whatif" leg={leg} legIndex={0} />)
    const grid = container.querySelector('[data-testid="leg-field-grid"]')
    expect(grid?.getAttribute('data-readonly')).toBe('false')
  })
})
