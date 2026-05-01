import type {
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  SwapConfig,
} from '@irsforge/shared-pricing'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { SolverTab } from '../solver-tab'

afterEach(() => cleanup())

const curve: DiscountCurve = {
  currency: 'USD',
  curveType: 'Discount',
  indexId: null,
  asOf: '2026-04-15T00:00:00Z',
  pillars: [
    { tenorDays: 91, zeroRate: 0.0431 },
    { tenorDays: 365, zeroRate: 0.0415 },
    { tenorDays: 1826, zeroRate: 0.0387 },
  ],
  interpolation: 'LinearZero',
  dayCount: 'Act360',
}

const sofr: FloatingRateIndex = {
  indexId: 'USD-SOFR',
  currency: 'USD',
  family: 'SOFR',
  compounding: 'CompoundedInArrears',
  lookback: 0,
  floor: null,
}

const schedule = {
  startDate: new Date('2026-04-15T00:00:00Z'),
  endDate: new Date('2027-04-15T00:00:00Z'),
  frequency: 'Quarterly' as const,
}
const fixedLeg: FixedLegConfig = {
  legType: 'fixed',
  direction: 'receive',
  currency: 'USD',
  notional: 50_000_000,
  rate: 0.0425,
  dayCount: 'ACT_360',
  schedule,
}
const floatLeg: FloatLegConfig = {
  legType: 'float',
  direction: 'pay',
  currency: 'USD',
  notional: -50_000_000,
  indexId: 'USD-SOFR',
  spread: 0,
  dayCount: 'ACT_360',
  schedule,
}
const swapConfig: SwapConfig = {
  type: 'IRS',
  legs: [fixedLeg, floatLeg],
  tradeDate: new Date('2026-04-10T00:00:00Z'),
  effectiveDate: schedule.startDate,
  maturityDate: schedule.endDate,
}
const ctx: PricingContext = { curve, index: sofr, observations: [] }

describe('SolverTab', () => {
  test('initial variable is spread when swap type is BASIS', () => {
    const { container } = render(
      <SolverTab
        swapType="BASIS"
        swapConfig={swapConfig}
        pricingCtx={ctx}
        onApplyLegPatch={vi.fn()}
      />,
    )
    const variableSelect = container.querySelectorAll('select')[0]
    expect(variableSelect.value).toBe('spread')
  })

  test('defaults to par rate × NPV with an Apply button', () => {
    const { container } = render(
      <SolverTab
        swapType="IRS"
        swapConfig={swapConfig}
        pricingCtx={ctx}
        onApplyLegPatch={vi.fn()}
      />,
    )
    expect(container.textContent).toMatch(/SOLVE/)
    expect(container.textContent).toMatch(/Result/)
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Apply'),
    )
    expect(btn).toBeDefined()
  })

  test('invalid target options are disabled for par rate variable', () => {
    const { container } = render(
      <SolverTab
        swapType="IRS"
        swapConfig={swapConfig}
        pricingCtx={ctx}
        onApplyLegPatch={vi.fn()}
      />,
    )
    const targetSelect = container.querySelectorAll('select')[1]
    const options = Array.from(targetSelect.querySelectorAll('option'))
    const byValue = Object.fromEntries(options.map((o) => [o.value, o]))
    expect(byValue.npv.disabled).toBe(false)
    expect(byValue.dv01.disabled).toBe(true)
    expect(byValue.modDuration.disabled).toBe(true)
    expect(byValue.krd.disabled).toBe(true)
  })

  test('hedge notional × DV01 produces a Copy button', () => {
    const { container } = render(
      <SolverTab
        swapType="IRS"
        swapConfig={swapConfig}
        pricingCtx={ctx}
        onApplyLegPatch={vi.fn()}
      />,
    )
    const variableSelect = container.querySelectorAll('select')[0]
    const targetSelect = container.querySelectorAll('select')[1]
    fireEvent.change(variableSelect, { target: { value: 'hedgeNotional' } })
    fireEvent.change(targetSelect, { target: { value: 'dv01' } })
    const copyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Copy'),
    )
    expect(copyBtn).toBeDefined()
  })

  test('Apply for par rate calls onApplyLegPatch with fixed leg index and a rate', () => {
    const onApply = vi.fn()
    const { container } = render(
      <SolverTab
        swapType="IRS"
        swapConfig={swapConfig}
        pricingCtx={ctx}
        onApplyLegPatch={onApply}
      />,
    )
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Apply'),
    )
    fireEvent.click(btn!)
    expect(onApply).toHaveBeenCalled()
    const [legIdx, patch] = onApply.mock.calls[0]
    expect(legIdx).toBe(0)
    expect(patch).toHaveProperty('rate')
    expect(typeof (patch as { rate: number }).rate).toBe('number')
  })
})
