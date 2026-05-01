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
import { RiskTab } from '../risk-tab'

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

const ctx: PricingContext = {
  curve,
  index: sofr,
  observations: [],
}

describe('RiskTab', () => {
  test('shows a placeholder when swapConfig or pricingCtx is null', () => {
    const { container } = render(<RiskTab swapConfig={null} pricingCtx={null} />)
    expect(container.textContent).toContain('unavailable')
  })

  test('renders one KRD row per pillar + a total row', () => {
    const { container } = render(<RiskTab swapConfig={swapConfig} pricingCtx={ctx} />)
    // Near-zero pillars are hidden by default; the 1-year swap only touches
    // the 91d and 365d tenors so 1826d (5Y) is filtered out unless toggled.
    expect(container.textContent).toMatch(/91d/)
    expect(container.textContent).toMatch(/365d/)
    expect(container.textContent).toMatch(/parallel DV01/)
    // Toggling "Show all pillars" reveals the full set including 1826d.
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    fireEvent.click(checkbox)
    expect(container.textContent).toMatch(/1826d/)
  })

  test('shows the Time section with horizon pills', () => {
    const { container } = render(<RiskTab swapConfig={swapConfig} pricingCtx={ctx} />)
    expect(container.textContent).toMatch(/TIME/)
    expect(container.textContent).toMatch(/Theta/)
    expect(container.textContent).toMatch(/Carry/)
    expect(container.textContent).toMatch(/Roll/)
    const pill = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === '+1D',
    )
    expect(pill).toBeDefined()
    fireEvent.click(pill!)
  })

  test('renders accrued / clean / dirty rows with an identity check', () => {
    const { container } = render(<RiskTab swapConfig={swapConfig} pricingCtx={ctx} />)
    expect(container.textContent).toMatch(/ACCRUED/)
    expect(container.textContent).toMatch(/Accrued/)
    expect(container.textContent).toMatch(/Clean/)
    expect(container.textContent).toMatch(/Dirty/)
    expect(container.textContent).toMatch(/clean \+ accrued − dirty/)
  })

  test('hides Basis DV01 row when no CurveBook is present', () => {
    const { container } = render(<RiskTab swapConfig={swapConfig} pricingCtx={ctx} />)
    expect(container.textContent).not.toMatch(/Basis DV01/)
  })

  test('hides Credit 01 row when swap is not CDS', () => {
    const { container } = render(<RiskTab swapConfig={swapConfig} pricingCtx={ctx} />)
    expect(container.textContent).not.toMatch(/Credit 01/)
  })

  test('Theta/Carry/Roll/Forward NPV rows carry tooltips and a horizon chip', () => {
    const { container } = render(<RiskTab swapConfig={swapConfig} pricingCtx={ctx} />)
    const theta = container.querySelector('[data-tooltip-key="theta"]')
    expect(theta?.getAttribute('title')).toMatch(/time decay/i)
    const carry = container.querySelector('[data-tooltip-key="carry"]')
    expect(carry?.getAttribute('title')).toMatch(/return earned/i)
    const fwd = container.querySelector('[data-tooltip-key="forward-npv"]')
    expect(fwd?.getAttribute('title')).toMatch(/projected NPV/i)
    const horizonChip = container.querySelector('[data-testid="theta-horizon"]')
    expect(horizonChip?.textContent).toBe('Next fix')
  })

  test('Accrued / Clean / Dirty labels carry tooltips', () => {
    const { container } = render(<RiskTab swapConfig={swapConfig} pricingCtx={ctx} />)
    expect(container.querySelector('[data-tooltip-key="accrued"]')?.getAttribute('title')).toMatch(
      /coupon earned/i,
    )
    expect(container.querySelector('[data-tooltip-key="clean"]')?.getAttribute('title')).toMatch(
      /excluding accrued/i,
    )
    expect(container.querySelector('[data-tooltip-key="dirty"]')?.getAttribute('title')).toMatch(
      /including accrued/i,
    )
  })
})
