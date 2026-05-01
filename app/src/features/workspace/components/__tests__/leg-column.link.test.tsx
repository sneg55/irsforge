import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { CashflowEntry, LegConfig } from '../../types'
import { LegColumn } from '../leg-column'

vi.mock('../../hooks/use-currency-options', () => ({
  useCurrencyOptions: () => [{ label: 'USD', value: 'USD' }],
}))
vi.mock('@/shared/ledger/useFloatingRateIndex', () => ({
  useFloatingRateIndices: () => ({ data: [] }),
}))
// Stub UnderlyingsEditor so we can fire its onChange directly.
const captured: { onChange?: (u: unknown) => void } = {}
vi.mock('../underlyings-editor', () => ({
  UnderlyingsEditor: (p: { onChange: (u: unknown) => void }) => {
    captured.onChange = p.onChange
    return <div data-testid="underlyings-editor" />
  },
}))

afterEach(() => {
  cleanup()
  captured.onChange = undefined
})

const schedule = {
  startDate: new Date('2026-04-14'),
  endDate: new Date('2031-04-14'),
  frequency: 'Quarterly' as const,
}

const baseProps = {
  cashflows: [] as CashflowEntry[],
  legPV: 0,
  onToggleDirection: () => {},
}

describe('LegColumn — link/underlyings branches', () => {
  test('leg 0 in draft mode: clicking link button fires onToggleNotionalLink', () => {
    const leg: LegConfig = {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional: 1_000_000,
      rate: 0.04,
      dayCount: 'ACT_360',
      schedule,
    }
    const onToggleNotionalLink = vi.fn()
    const { container } = render(
      <LegColumn
        {...baseProps}
        leg={leg}
        legIndex={0}
        mode="draft"
        onUpdateLeg={vi.fn()}
        onNotionalChange={vi.fn()}
        notionalLinked
        onToggleNotionalLink={onToggleNotionalLink}
      />,
    )
    const linkBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('🔗'),
    )
    expect(linkBtn).toBeDefined()
    fireEvent.click(linkBtn!)
    expect(onToggleNotionalLink).toHaveBeenCalled()
  })

  test('unlinked state shows 🔓 icon', () => {
    const leg: LegConfig = {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional: 1_000_000,
      rate: 0.04,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container } = render(
      <LegColumn
        {...baseProps}
        leg={leg}
        legIndex={0}
        mode="draft"
        onUpdateLeg={vi.fn()}
        onNotionalChange={vi.fn()}
        notionalLinked={false}
        onToggleNotionalLink={vi.fn()}
      />,
    )
    const unlinkBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('🔓'),
    )
    expect(unlinkBtn).toBeDefined()
  })

  test('asset leg renders UnderlyingsEditor and its onChange forwards to onUpdateLeg', () => {
    const onUpdateLeg = vi.fn()
    const leg: LegConfig = {
      legType: 'asset',
      direction: 'receive',
      notional: 1_000_000,
      underlyings: [{ assetId: 'AAPL', weight: 1, initialPrice: 100, currentPrice: 110 }],
    }
    render(
      <LegColumn
        {...baseProps}
        leg={leg}
        legIndex={0}
        mode="draft"
        onUpdateLeg={onUpdateLeg}
        onNotionalChange={vi.fn()}
      />,
    )
    expect(captured.onChange).toBeTypeOf('function')
    captured.onChange!([{ assetId: 'MSFT', weight: 1, initialPrice: 300, currentPrice: 320 }])
    expect(onUpdateLeg).toHaveBeenCalledWith('underlyings', [
      { assetId: 'MSFT', weight: 1, initialPrice: 300, currentPrice: 320 },
    ])
  })

  test('leg 1 does not render the link button', () => {
    const leg: LegConfig = {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional: 1_000_000,
      rate: 0.04,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container } = render(
      <LegColumn
        {...baseProps}
        leg={leg}
        legIndex={1}
        mode="draft"
        onUpdateLeg={vi.fn()}
        onNotionalChange={vi.fn()}
        notionalLinked
        onToggleNotionalLink={vi.fn()}
      />,
    )
    const linkBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('🔗'),
    )
    expect(linkBtn).toBeUndefined()
  })
})
