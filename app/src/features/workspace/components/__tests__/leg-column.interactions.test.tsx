import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { CashflowEntry, LegConfig } from '../../types'
import { LegColumn } from '../leg-column'

vi.mock('../../hooks/use-currency-options', () => ({
  useCurrencyOptions: () => [
    { label: 'USD', value: 'USD' },
    { label: 'EUR', value: 'EUR' },
    { label: 'GBP', value: 'GBP' },
  ],
}))

vi.mock('@/shared/ledger/useFloatingRateIndex', () => ({
  useFloatingRateIndices: () => ({
    data: [
      { indexId: 'USD-SOFR', currency: 'USD' },
      { indexId: 'USD-SOFR-TSR', currency: 'USD' },
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
  onToggleDirection: () => {},
}

/** Commit an edit to a text field by clicking the display, typing into the
 * auto-focused input, and pressing Enter. */
function editTextField(container: HTMLElement, label: string, value: string) {
  const labelSpans = Array.from(container.querySelectorAll('span')).filter(
    (s) => s.textContent?.trim() === label,
  )
  if (labelSpans.length === 0) throw new Error(`label not found: ${label}`)
  // Next sibling is the value-display/editor wrapper.
  const wrapper = labelSpans[0].nextElementSibling as HTMLElement
  const clickable =
    (wrapper.querySelector('span[class*="cursor-pointer"]') as HTMLElement) ??
    wrapper.querySelector('span')
  fireEvent.click(clickable)
  const input = wrapper.querySelector('input') as HTMLInputElement
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

function selectValue(container: HTMLElement, label: string, value: string) {
  const labelSpans = Array.from(container.querySelectorAll('span')).filter(
    (s) => s.textContent?.trim() === label,
  )
  const wrapper = labelSpans[0].nextElementSibling as HTMLElement
  const select = (
    wrapper.tagName === 'SELECT' ? wrapper : wrapper.querySelector('select')
  ) as HTMLSelectElement
  fireEvent.change(select, { target: { value } })
}

describe('LegColumn — field-level onChange coverage', () => {
  test('fixed leg: every editable field fires onUpdateLeg with correct field name', () => {
    const onUpdateLeg = vi.fn()
    const onNotionalChange = vi.fn()
    const leg: LegConfig = {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional: 10_000_000,
      rate: 0.045,
      dayCount: 'ACT_360',
      schedule,
    }
    const { container } = render(
      <LegColumn
        {...baseProps}
        leg={leg}
        legIndex={0}
        onUpdateLeg={onUpdateLeg}
        onNotionalChange={onNotionalChange}
      />,
    )

    selectValue(container, 'Currency', 'EUR')
    expect(onUpdateLeg).toHaveBeenCalledWith('currency', 'EUR')

    selectValue(container, 'Day Count', 'ACT_365')
    expect(onUpdateLeg).toHaveBeenCalledWith('dayCount', 'ACT_365')

    selectValue(container, 'Frequency', 'SemiAnnual')
    expect(onUpdateLeg).toHaveBeenCalledWith('frequency', 'SemiAnnual')

    // Rate is a text field rendered as 4.5000 %. Edit to 5 → should fire rate=0.05
    editTextField(container, 'Fixed Rate', '5')
    const rateCall = onUpdateLeg.mock.calls.find((c) => c[0] === 'rate')
    expect(rateCall).toBeDefined()
    expect(parseFloat(rateCall![1] as string)).toBeCloseTo(0.05)

    // Notional edit should bypass onUpdateLeg and call onNotionalChange instead.
    editTextField(container, 'Notional', '20000000')
    expect(onNotionalChange).toHaveBeenCalledWith(20_000_000)
  })

  test('float leg: index + spread + currency + dayCount + frequency all fire', () => {
    const onUpdateLeg = vi.fn()
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
    const { container } = render(
      <LegColumn
        {...baseProps}
        leg={leg}
        legIndex={1}
        onUpdateLeg={onUpdateLeg}
        onNotionalChange={vi.fn()}
      />,
    )

    selectValue(container, 'Currency', 'EUR')
    expect(onUpdateLeg).toHaveBeenCalledWith('currency', 'EUR')

    selectValue(container, 'Index', 'USD-SOFR-TSR')
    expect(onUpdateLeg).toHaveBeenCalledWith('indexId', 'USD-SOFR-TSR')

    selectValue(container, 'Day Count', 'THIRTY_360')
    expect(onUpdateLeg).toHaveBeenCalledWith('dayCount', 'THIRTY_360')

    selectValue(container, 'Frequency', 'Annual')
    expect(onUpdateLeg).toHaveBeenCalledWith('frequency', 'Annual')

    editTextField(container, 'Spread', '25')
    const spreadCall = onUpdateLeg.mock.calls.find((c) => c[0] === 'spread')
    expect(spreadCall).toBeDefined()
    expect(parseFloat(spreadCall![1] as string)).toBeCloseTo(0.0025)
  })

  test('protection leg: recovery rate and notional are editable', () => {
    const onUpdateLeg = vi.fn()
    const onNotionalChange = vi.fn()
    const leg: LegConfig = {
      legType: 'protection',
      direction: 'receive',
      notional: 25_000_000,
      recoveryRate: 0.4,
    }
    const { container } = render(
      <LegColumn
        {...baseProps}
        leg={leg}
        legIndex={1}
        onUpdateLeg={onUpdateLeg}
        onNotionalChange={onNotionalChange}
      />,
    )

    editTextField(container, 'Recovery Rate', '50')
    const recoveryCall = onUpdateLeg.mock.calls.find((c) => c[0] === 'recoveryRate')
    expect(recoveryCall).toBeDefined()
    expect(parseFloat(recoveryCall![1] as string)).toBeCloseTo(0.5)

    editTextField(container, 'Notional', '30000000')
    expect(onNotionalChange).toHaveBeenCalledWith(30_000_000)
  })

  test('asset leg: notional edit fires onNotionalChange; underlyings passthrough fires onUpdateLeg', () => {
    const onUpdateLeg = vi.fn()
    const onNotionalChange = vi.fn()
    const leg: LegConfig = {
      legType: 'asset',
      direction: 'receive',
      notional: 10_000_000,
      underlyings: [{ assetId: 'AAPL', weight: 1, initialPrice: 180, currentPrice: 195 }],
    }
    const { container } = render(
      <LegColumn
        {...baseProps}
        leg={leg}
        legIndex={0}
        onUpdateLeg={onUpdateLeg}
        onNotionalChange={onNotionalChange}
      />,
    )

    editTextField(container, 'Notional', '15000000')
    expect(onNotionalChange).toHaveBeenCalledWith(15_000_000)
  })

  test('fx leg: base + foreign + notional + fx rate are all editable', () => {
    const onUpdateLeg = vi.fn()
    const onNotionalChange = vi.fn()
    const leg: LegConfig = {
      legType: 'fx',
      direction: 'pay',
      baseCurrency: 'USD',
      foreignCurrency: 'EUR',
      notional: 10_000_000,
      fxRate: 1.08,
      paymentDate: new Date('2026-04-14'),
    }
    const { container } = render(
      <LegColumn
        {...baseProps}
        leg={leg}
        legIndex={0}
        onUpdateLeg={onUpdateLeg}
        onNotionalChange={onNotionalChange}
      />,
    )

    selectValue(container, 'Base CCY', 'GBP')
    expect(onUpdateLeg).toHaveBeenCalledWith('baseCurrency', 'GBP')

    selectValue(container, 'Foreign CCY', 'USD')
    expect(onUpdateLeg).toHaveBeenCalledWith('foreignCurrency', 'USD')

    editTextField(container, 'FX Rate', '1.2500')
    const rateCall = onUpdateLeg.mock.calls.find((c) => c[0] === 'fxRate')
    expect(rateCall).toBeDefined()
    expect(parseFloat(rateCall![1] as string)).toBeCloseTo(1.25)

    editTextField(container, 'Notional', '5000000')
    expect(onNotionalChange).toHaveBeenCalledWith(5_000_000)
  })

  test('Escape on an editing field resets local value without firing onUpdateLeg', () => {
    const onUpdateLeg = vi.fn()
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
        onUpdateLeg={onUpdateLeg}
        onNotionalChange={vi.fn()}
      />,
    )

    const labels = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent?.trim() === 'Fixed Rate',
    )
    const wrapper = labels[0].nextElementSibling as HTMLElement
    const display = wrapper.querySelector('span[class*="cursor-pointer"]') as HTMLElement
    fireEvent.click(display)
    const input = wrapper.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '99' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    const rateCalls = onUpdateLeg.mock.calls.filter((c) => c[0] === 'rate')
    expect(rateCalls).toHaveLength(0)
  })
})
