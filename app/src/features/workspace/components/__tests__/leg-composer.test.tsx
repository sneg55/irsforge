import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { LegConfig } from '../../types'
import { LegComposer } from '../leg-composer'

vi.mock('../../hooks/use-currency-options', () => ({
  useCurrencyOptions: () => [
    { label: 'USD', value: 'USD' },
    { label: 'EUR', value: 'EUR' },
  ],
}))

vi.mock('@/shared/ledger/useFloatingRateIndex', () => ({
  useFloatingRateIndices: () => ({
    data: [{ indexId: 'USD-SOFR', currency: 'USD' }],
  }),
}))

afterEach(() => cleanup())

const schedule = {
  startDate: new Date('2026-04-14'),
  endDate: new Date('2031-04-14'),
  frequency: 'Quarterly' as const,
}

function fixedLeg(ccy = 'USD'): LegConfig {
  return {
    legType: 'fixed',
    direction: 'receive',
    currency: ccy,
    notional: 10_000_000,
    rate: 0.04,
    dayCount: 'ACT_360',
    schedule,
  }
}

function floatLeg(ccy = 'USD'): LegConfig {
  return {
    legType: 'float',
    direction: 'pay',
    currency: ccy,
    notional: 10_000_000,
    indexId: 'USD-SOFR',
    spread: 0,
    dayCount: 'ACT_360',
    schedule,
  }
}

describe('LegComposer', () => {
  test('renders one card per leg with STREAM i header', () => {
    const { container } = render(
      <LegComposer
        legs={[fixedLeg(), floatLeg()]}
        cashflows={[[], []]}
        legPVs={[100, -50]}
        mode="draft"
        onUpdateLeg={() => {}}
        onAddLeg={() => {}}
        onRemoveLeg={() => {}}
      />,
    )
    expect(container.textContent).toContain('STREAM 1')
    expect(container.textContent).toContain('STREAM 2')
    expect(container.textContent).toContain('FIXED')
    expect(container.textContent).toContain('FLOAT')
  })

  test('Add Leg button fires onAddLeg when editable', () => {
    const onAddLeg = vi.fn()
    const { container } = render(
      <LegComposer
        legs={[fixedLeg()]}
        cashflows={[[]]}
        legPVs={[0]}
        mode="draft"
        onUpdateLeg={() => {}}
        onAddLeg={onAddLeg}
        onRemoveLeg={() => {}}
      />,
    )
    const addBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Add Leg'),
    )
    fireEvent.click(addBtn as HTMLElement)
    expect(onAddLeg).toHaveBeenCalledTimes(1)
  })

  test('view mode hides Add Leg and the per-leg × remove/legType select', () => {
    const { container } = render(
      <LegComposer
        legs={[fixedLeg(), floatLeg()]}
        cashflows={[[], []]}
        legPVs={[0, 0]}
        mode="active"
        onUpdateLeg={() => {}}
        onAddLeg={() => {}}
        onRemoveLeg={() => {}}
      />,
    )
    expect(container.textContent).not.toContain('Add Leg')
    // The legType select and × remove button should be absent.
    expect(container.querySelector('select[value="fixed"]')).toBeNull()
  })

  test('Remove button fires onRemoveLeg with the clicked leg index', () => {
    const onRemoveLeg = vi.fn()
    const { container } = render(
      <LegComposer
        legs={[fixedLeg(), floatLeg()]}
        cashflows={[[], []]}
        legPVs={[0, 0]}
        mode="draft"
        onUpdateLeg={() => {}}
        onAddLeg={() => {}}
        onRemoveLeg={onRemoveLeg}
      />,
    )
    // Two × buttons (one per leg, shown because legs.length > 1).
    const removeBtns = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === '×',
    )
    expect(removeBtns.length).toBe(2)
    fireEvent.click(removeBtns[1])
    expect(onRemoveLeg).toHaveBeenCalledWith(1)
  })

  test('legType select fires onUpdateLeg with "legType" field', () => {
    const onUpdateLeg = vi.fn()
    const { container } = render(
      <LegComposer
        legs={[fixedLeg()]}
        cashflows={[[]]}
        legPVs={[0]}
        mode="draft"
        onUpdateLeg={onUpdateLeg}
        onAddLeg={() => {}}
        onRemoveLeg={() => {}}
      />,
    )
    const select = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'float' } })
    expect(onUpdateLeg).toHaveBeenCalledWith(0, 'legType', 'float')
  })

  test('renders CASHFLOWS section only when cashflows has entries', () => {
    const { container: empty } = render(
      <LegComposer
        legs={[fixedLeg()]}
        cashflows={[[]]}
        legPVs={[0]}
        mode="draft"
        onUpdateLeg={() => {}}
        onAddLeg={() => {}}
        onRemoveLeg={() => {}}
      />,
    )
    expect(empty.textContent).not.toContain('CASHFLOWS')

    const cashflow = [
      {
        date: new Date('2026-07-14'),
        amount: 100000,
        discountFactor: 0.99,
      },
    ]
    const { container: withCf } = render(
      <LegComposer
        legs={[fixedLeg()]}
        cashflows={[cashflow as never]}
        legPVs={[100]}
        mode="draft"
        onUpdateLeg={() => {}}
        onAddLeg={() => {}}
        onRemoveLeg={() => {}}
      />,
    )
    expect(withCf.textContent).toContain('CASHFLOWS')
  })
})
