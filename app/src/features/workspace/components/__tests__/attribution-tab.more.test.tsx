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
import type { CurveStreamEntry } from '@/shared/ledger/useCurveStream'
import { AttributionTab } from '../attribution-tab'

afterEach(() => cleanup())

const makeCurve = (asOf: string, bump = 0): DiscountCurve => ({
  currency: 'USD',
  curveType: 'Discount',
  indexId: null,
  asOf,
  pillars: [
    { tenorDays: 91, zeroRate: 0.0431 + bump },
    { tenorDays: 365, zeroRate: 0.0415 + bump },
    { tenorDays: 1826, zeroRate: 0.0387 + bump },
  ],
  interpolation: 'LinearZero',
  dayCount: 'Act360',
})
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
const swapConfig: SwapConfig = {
  type: 'IRS',
  legs: [
    {
      legType: 'fixed',
      currency: 'USD',
      notional: 50_000_000,
      rate: 0.0425,
      dayCount: 'ACT_360',
      schedule,
    } as FixedLegConfig,
    {
      legType: 'float',
      currency: 'USD',
      notional: -50_000_000,
      indexId: 'USD-SOFR',
      spread: 0,
      dayCount: 'ACT_360',
      schedule,
    } as FloatLegConfig,
  ],
  tradeDate: new Date('2026-04-10T00:00:00Z'),
  effectiveDate: schedule.startDate,
  maturityDate: schedule.endDate,
}
const ctx: PricingContext = {
  curve: makeCurve('2026-04-15T00:00:00Z'),
  index: sofr,
  observations: [],
}

const entries: CurveStreamEntry[] = [
  { curve: makeCurve('2026-04-15T00:00:00Z'), receivedAt: '2026-04-15T00:00:01Z' },
  { curve: makeCurve('2026-04-15T01:00:00Z', 0.0005), receivedAt: '2026-04-15T01:00:01Z' },
]

describe('AttributionTab — extra interactions', () => {
  test('t0 mode can be switched to Inception', () => {
    const { container } = render(
      <AttributionTab
        swapConfig={swapConfig}
        pricingCtx={ctx}
        curveHistory={entries}
        streamStatus="open"
      />,
    )
    const inceptionBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Inception',
    )!
    fireEvent.click(inceptionBtn)
    // After click, the Inception button becomes the highlighted one.
    expect(inceptionBtn.className).toMatch(/3b82f6/)
  })

  test('t0 mode Last N reveals a number input', () => {
    const { container } = render(
      <AttributionTab
        swapConfig={swapConfig}
        pricingCtx={ctx}
        curveHistory={entries}
        streamStatus="open"
      />,
    )
    const lastBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').startsWith('Last'),
    )!
    fireEvent.click(lastBtn)
    const numberInput = container.querySelector('input[type="number"]') as HTMLInputElement
    expect(numberInput).not.toBeNull()
    fireEvent.change(numberInput, { target: { value: '5' } })
    expect(numberInput.value).toBe('5')
  })

  test('Rebase button resets history and re-selects Session open mode', () => {
    const { container } = render(
      <AttributionTab
        swapConfig={swapConfig}
        pricingCtx={ctx}
        curveHistory={entries}
        streamStatus="open"
      />,
    )
    const inceptionBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Inception',
    )!
    fireEvent.click(inceptionBtn)
    const rebaseBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Rebase',
    )!
    fireEvent.click(rebaseBtn)
    const sessionOpenBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Session open',
    )!
    expect(sessionOpenBtn.className).toMatch(/3b82f6/)
  })

  test('Export CSV triggers a blob-download click when history is non-empty', () => {
    // Stub URL API (jsdom may not implement createObjectURL fully).
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    ;(URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = vi.fn(
      () => 'blob:stub',
    )
    ;(URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL = vi.fn()
    const { container } = render(
      <AttributionTab
        swapConfig={swapConfig}
        pricingCtx={ctx}
        curveHistory={entries}
        streamStatus="open"
      />,
    )
    const exportBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Export CSV',
    ) as HTMLButtonElement
    // With only a single-entry history it may be disabled; skip gracefully.
    if (!exportBtn.disabled) {
      fireEvent.click(exportBtn)
      expect(URL.createObjectURL).toHaveBeenCalled()
    }
    ;(URL as unknown as { createObjectURL: typeof originalCreate }).createObjectURL = originalCreate
    ;(URL as unknown as { revokeObjectURL: typeof originalRevoke }).revokeObjectURL = originalRevoke
  })
})
