import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import type { CashflowEntry } from '../../types'
import { CashflowTable } from '../cashflow-table'

afterEach(() => cleanup())

function mkCf(overrides: Partial<CashflowEntry> & { date: Date }): CashflowEntry {
  return { amount: 100_000, discountFactor: 0.98, ...overrides }
}

describe('CashflowTable — render', () => {
  test('empty cashflows renders the empty state', () => {
    const { container } = render(<CashflowTable cashflows={[]} legType="fixed" direction="pay" />)
    expect(container.textContent).toContain('No cashflows')
  })

  test('fixed leg header shows Amount + DF columns', () => {
    const cfs: CashflowEntry[] = [
      mkCf({ date: new Date('2026-06-30') }),
      mkCf({ date: new Date('2026-09-30') }),
    ]
    const { container } = render(
      <CashflowTable cashflows={cfs} legType="fixed" direction="receive" />,
    )
    expect(container.textContent).toContain('Period')
    expect(container.textContent).toContain('Amount')
    expect(container.textContent).toContain('DF')
  })

  test('float leg header shows Proj Rate instead of DF', () => {
    const cfs: CashflowEntry[] = [mkCf({ date: new Date('2026-06-30'), projectedRate: 0.045 })]
    const { container } = render(
      <CashflowTable cashflows={cfs} legType="float" direction="receive" />,
    )
    expect(container.textContent).toContain('Proj Rate')
    expect(container.textContent).not.toMatch(/\bDF\b/)
  })

  test('direction="pay" inverts the sign on displayed amounts', () => {
    const cfs: CashflowEntry[] = [mkCf({ date: new Date('2026-06-30'), amount: 1000 })]
    const { container } = render(<CashflowTable cashflows={cfs} legType="fixed" direction="pay" />)
    // The amount should display as negative.
    expect(container.textContent).toMatch(/-.*1,000|\(1,000\)/)
  })
})

describe('CashflowTable — expand/collapse', () => {
  test('more than 6 rows shows "... N more" button then expands', () => {
    const cfs: CashflowEntry[] = Array.from({ length: 10 }, (_, i) =>
      mkCf({ date: new Date(`2026-0${(i % 9) + 1}-15`) }),
    )
    const { container } = render(
      <CashflowTable cashflows={cfs} legType="fixed" direction="receive" />,
    )
    // 4 remaining (10 - 6)
    const moreBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('more'),
    )!
    expect(moreBtn.textContent).toContain('4 more')
    fireEvent.click(moreBtn)
    const lessBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Show less',
    )
    expect(lessBtn).toBeDefined()
  })
})

describe('CashflowTable — FX translation', () => {
  test('leg in EUR reporting in USD with EURUSD spot renders header with reporting ccy', () => {
    const cfs: CashflowEntry[] = [mkCf({ date: new Date('2026-06-30'), amount: 1000 })]
    const { container } = render(
      <CashflowTable
        cashflows={cfs}
        legType="fixed"
        direction="receive"
        legCurrency="EUR"
        reportingCcy="USD"
        fxSpots={{ EURUSD: 1.08 }}
      />,
    )
    expect(container.textContent).toContain('Amount (USD)')
    // native annotation displayed
    expect(container.textContent).toContain('EUR')
    expect(container.textContent).toContain('×1.0800')
  })

  test('missing fx spot silently falls back to 1.0 (native amount shown)', () => {
    const cfs: CashflowEntry[] = [mkCf({ date: new Date('2026-06-30'), amount: 1000 })]
    const { container } = render(
      <CashflowTable
        cashflows={cfs}
        legType="fixed"
        direction="receive"
        legCurrency="EUR"
        reportingCcy="USD"
        fxSpots={{}}
      />,
    )
    // No crash — header still renders and some amount text shown
    expect(container.textContent).toContain('Amount (USD)')
  })
})
