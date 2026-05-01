import type {
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  SwapConfig,
} from '@irsforge/shared-pricing'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
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

describe('AttributionTab', () => {
  test('shows placeholder when swapConfig is missing', () => {
    const { container } = render(
      <AttributionTab swapConfig={null} pricingCtx={null} curveHistory={[]} streamStatus="idle" />,
    )
    expect(container.textContent).toMatch(/unavailable/)
  })

  test('shows "Waiting…" until a curve-stream tick arrives', () => {
    const { container } = render(
      <AttributionTab
        swapConfig={swapConfig}
        pricingCtx={ctx}
        curveHistory={[]}
        streamStatus="connecting"
      />,
    )
    expect(container.textContent).toMatch(/Waiting/)
  })

  test('renders 5 bucket rows after a stream entry lands', () => {
    const entries: CurveStreamEntry[] = [
      { curve: makeCurve('2026-04-15T00:00:00Z'), receivedAt: '2026-04-15T00:00:01Z' },
      { curve: makeCurve('2026-04-15T01:00:00Z', 0.0005), receivedAt: '2026-04-15T01:00:01Z' },
    ]
    const { container } = render(
      <AttributionTab
        swapConfig={swapConfig}
        pricingCtx={ctx}
        curveHistory={entries}
        streamStatus="open"
      />,
    )
    // Bucket labels
    expect(container.textContent).toMatch(/carry/i)
    expect(container.textContent).toMatch(/roll/i)
    expect(container.textContent).toMatch(/curve/i)
    expect(container.textContent).toMatch(/basis/i)
    expect(container.textContent).toMatch(/fixing/i)
    expect(container.textContent).toMatch(/Total/)
  })

  test('Pause / Rebase / Export CSV controls are present', () => {
    const entries: CurveStreamEntry[] = [
      { curve: makeCurve('2026-04-15T00:00:00Z'), receivedAt: '2026-04-15T00:00:01Z' },
    ]
    const { container } = render(
      <AttributionTab
        swapConfig={swapConfig}
        pricingCtx={ctx}
        curveHistory={entries}
        streamStatus="open"
      />,
    )
    const labels = Array.from(container.querySelectorAll('button')).map((b) => b.textContent)
    expect(labels).toContain('Pause')
    expect(labels).toContain('Rebase')
    expect(labels).toContain('Export CSV')
  })

  test('streaming badge reflects status prop', () => {
    const { container, rerender } = render(
      <AttributionTab
        swapConfig={swapConfig}
        pricingCtx={ctx}
        curveHistory={[]}
        streamStatus="open"
      />,
    )
    expect(container.textContent).toMatch(/Live/)
    rerender(
      <AttributionTab
        swapConfig={swapConfig}
        pricingCtx={ctx}
        curveHistory={[]}
        streamStatus="fallback"
      />,
    )
    expect(container.textContent).toMatch(/Polling/)
  })

  test('clicking Pause toggles to Resume', () => {
    const entries: CurveStreamEntry[] = [
      { curve: makeCurve('2026-04-15T00:00:00Z'), receivedAt: '2026-04-15T00:00:01Z' },
    ]
    const { container } = render(
      <AttributionTab
        swapConfig={swapConfig}
        pricingCtx={ctx}
        curveHistory={entries}
        streamStatus="open"
      />,
    )
    const pauseBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Pause',
    )
    fireEvent.click(pauseBtn!)
    expect(container.textContent).toMatch(/Resume/)
  })
})
