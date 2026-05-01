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

describe('SolverTab — extra branches', () => {
  test('renders placeholder when swapConfig is null', () => {
    const { container } = render(
      <SolverTab swapType="IRS" swapConfig={null} pricingCtx={null} onApplyLegPatch={vi.fn()} />,
    )
    expect(container.textContent).toMatch(/unavailable/)
  })

  test('changing variable to spread re-runs solver and renders a Result section', () => {
    const { container } = render(
      <SolverTab
        swapType="IRS"
        swapConfig={swapConfig}
        pricingCtx={ctx}
        onApplyLegPatch={vi.fn()}
      />,
    )
    const variableSelect = container.querySelectorAll('select')[0]
    fireEvent.change(variableSelect, { target: { value: 'spread' } })
    expect(variableSelect.value).toBe('spread')
    // Whether Newton converges or not, a Result panel is rendered.
    expect(container.textContent).toMatch(/Result/)
  })

  test('changing target to dv01 when variable=hedgeNotional updates target select', () => {
    const { container } = render(
      <SolverTab
        swapType="IRS"
        swapConfig={swapConfig}
        pricingCtx={ctx}
        onApplyLegPatch={vi.fn()}
      />,
    )
    const variableSelect = container.querySelectorAll('select')[0]
    fireEvent.change(variableSelect, { target: { value: 'hedgeNotional' } })
    const targetSelect = container.querySelectorAll('select')[1]
    fireEvent.change(targetSelect, { target: { value: 'dv01' } })
    expect(targetSelect.value).toBe('dv01')
  })

  test('hedgeNotional × DV01 shows Copy button and does not fire onApplyLegPatch on click', () => {
    const onApply = vi.fn()
    const { container } = render(
      <SolverTab
        swapType="IRS"
        swapConfig={swapConfig}
        pricingCtx={ctx}
        onApplyLegPatch={onApply}
      />,
    )
    const variableSelect = container.querySelectorAll('select')[0]
    fireEvent.change(variableSelect, { target: { value: 'hedgeNotional' } })
    const targetSelect = container.querySelectorAll('select')[1]
    fireEvent.change(targetSelect, { target: { value: 'dv01' } })
    const copyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Copy'),
    )
    expect(copyBtn).toBeDefined()
    // Stub clipboard so the click handler does not throw in jsdom.
    ;(navigator as unknown as { clipboard: { writeText: (s: string) => void } }).clipboard = {
      writeText: vi.fn(),
    }
    fireEvent.click(copyBtn!)
    expect(onApply).not.toHaveBeenCalled()
  })

  test('unwindPv variable auto-targets npv and exposes a Copy button', () => {
    const { container } = render(
      <SolverTab
        swapType="IRS"
        swapConfig={swapConfig}
        pricingCtx={ctx}
        onApplyLegPatch={vi.fn()}
      />,
    )
    const variableSelect = container.querySelectorAll('select')[0]
    fireEvent.change(variableSelect, { target: { value: 'unwindPv' } })
    const copyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Copy'),
    )
    expect(copyBtn).toBeDefined()
  })
})
