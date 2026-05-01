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
    data: [
      { indexId: 'USD-SOFR', currency: 'USD' },
      { indexId: 'USD-LIBOR', currency: 'USD' },
    ],
  }),
}))

afterEach(() => cleanup())

const schedule = {
  startDate: new Date('2026-04-14'),
  endDate: new Date('2031-04-14'),
  frequency: 'Quarterly' as const,
}

function fixedLeg(): LegConfig {
  return {
    legType: 'fixed',
    direction: 'receive',
    currency: 'USD',
    notional: 10_000_000,
    rate: 0.04,
    dayCount: 'ACT_360',
    schedule,
  }
}

function floatLeg(): LegConfig {
  return {
    legType: 'float',
    direction: 'pay',
    currency: 'USD',
    notional: 10_000_000,
    indexId: 'USD-SOFR',
    spread: 0.0005,
    dayCount: 'ACT_360',
    schedule,
  }
}

function editTextField(container: HTMLElement, label: string, value: string) {
  const labelSpans = Array.from(container.querySelectorAll('span')).filter(
    (s) => s.textContent?.trim() === label,
  )
  const wrapper = labelSpans[0].nextElementSibling as HTMLElement
  const clickable =
    (wrapper.querySelector('span[class*="cursor-pointer"]') as HTMLElement) ??
    wrapper.querySelector('span')
  fireEvent.click(clickable)
  const input = wrapper.querySelector('input') as HTMLInputElement
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

function selectByLabel(container: HTMLElement, label: string, value: string) {
  const labelSpans = Array.from(container.querySelectorAll('span')).filter(
    (s) => s.textContent?.trim() === label,
  )
  const wrapper = labelSpans[0].nextElementSibling as HTMLElement
  const select = (
    wrapper.tagName === 'SELECT' ? wrapper : wrapper.querySelector('select')
  ) as HTMLSelectElement
  fireEvent.change(select, { target: { value } })
}

describe('LegComposer — field-level onUpdateLeg coverage', () => {
  test('fixed-leg fields all fire onUpdateLeg with the clicked leg index', () => {
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
    selectByLabel(container, 'Currency', 'EUR')
    expect(onUpdateLeg).toHaveBeenCalledWith(0, 'currency', 'EUR')

    selectByLabel(container, 'Day Count', 'ACT_365')
    expect(onUpdateLeg).toHaveBeenCalledWith(0, 'dayCount', 'ACT_365')

    selectByLabel(container, 'Frequency', 'Annual')
    expect(onUpdateLeg).toHaveBeenCalledWith(0, 'frequency', 'Annual')

    editTextField(container, 'Notional', '12500000')
    expect(onUpdateLeg.mock.calls.some((c) => c[0] === 0 && c[1] === 'notional')).toBe(true)

    editTextField(container, 'Rate', '5')
    expect(onUpdateLeg.mock.calls.some((c) => c[0] === 0 && c[1] === 'rate')).toBe(true)
  })

  test('float-leg: index select + spread text + frequency + currency all fire', () => {
    const onUpdateLeg = vi.fn()
    const { container } = render(
      <LegComposer
        legs={[floatLeg()]}
        cashflows={[[]]}
        legPVs={[0]}
        mode="draft"
        onUpdateLeg={onUpdateLeg}
        onAddLeg={() => {}}
        onRemoveLeg={() => {}}
      />,
    )

    selectByLabel(container, 'Index', 'USD-LIBOR')
    expect(onUpdateLeg).toHaveBeenCalledWith(0, 'indexId', 'USD-LIBOR')

    selectByLabel(container, 'Frequency', 'Monthly')
    expect(onUpdateLeg).toHaveBeenCalledWith(0, 'frequency', 'Monthly')

    selectByLabel(container, 'Currency', 'EUR')
    expect(onUpdateLeg).toHaveBeenCalledWith(0, 'currency', 'EUR')

    editTextField(container, 'Spread', '50')
    expect(onUpdateLeg.mock.calls.some((c) => c[0] === 0 && c[1] === 'spread')).toBe(true)
  })

  test('fires with the correct leg index for multi-leg setups', () => {
    const onUpdateLeg = vi.fn()
    const { container } = render(
      <LegComposer
        legs={[fixedLeg(), floatLeg()]}
        cashflows={[[], []]}
        legPVs={[0, 0]}
        mode="draft"
        onUpdateLeg={onUpdateLeg}
        onAddLeg={() => {}}
        onRemoveLeg={() => {}}
      />,
    )
    // Find "Frequency" label on leg 2 (second occurrence).
    const freqLabels = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent?.trim() === 'Frequency',
    )
    const wrapper = freqLabels[1].nextElementSibling as HTMLElement
    const select = (
      wrapper.tagName === 'SELECT' ? wrapper : wrapper.querySelector('select')
    ) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'SemiAnnual' } })
    expect(onUpdateLeg).toHaveBeenCalledWith(1, 'frequency', 'SemiAnnual')
  })
})
