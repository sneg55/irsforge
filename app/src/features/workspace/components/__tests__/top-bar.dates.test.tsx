import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { WorkspaceDates } from '../../utils/date-recalc'
import { TopBar } from '../top-bar'

afterEach(() => cleanup())

const mockUseConfig = vi.fn()
vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => mockUseConfig(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/workspace',
}))

vi.mock('@/features/fpml-import/import-modal', () => ({
  ImportFpmlModal: () => null,
}))

// Stub EditableDate + EditableTenor so we can directly invoke their onChange
// props (the TopBar passes four inline arrows — those are the uncovered funcs).
const captured: Record<string, ((v: unknown) => void) | undefined> = {}
vi.mock('../editable-date', () => ({
  EditableDate: (p: { label: string; onChange: (d: Date) => void }) => {
    captured[p.label] = p.onChange as (v: unknown) => void
    return <div data-label={p.label} />
  },
}))
vi.mock('../editable-tenor', () => ({
  EditableTenor: (p: { onChange: (t: unknown) => void }) => {
    captured.tenor = p.onChange
    return <div data-label="Tenor" />
  },
}))

const baseDates: WorkspaceDates = {
  tradeDate: new Date('2026-04-15'),
  effectiveDate: new Date('2026-04-15'),
  maturityDate: new Date('2027-04-15'),
  tenor: { years: 1, months: 0 },
  anchor: 'tenor',
  effManuallySet: false,
}

describe('TopBar date-change inline handlers', () => {
  beforeEach(() => {
    mockUseConfig.mockReset()
    mockUseConfig.mockReturnValue({ config: null, loading: false, getOrg: () => undefined })
    for (const k of Object.keys(captured)) delete captured[k]
  })

  test('Trade EditableDate onChange fires onDateChange("trade", d)', () => {
    const onDateChange = vi.fn()
    render(
      <TopBar
        swapType="IRS"
        onTypeChange={vi.fn()}
        dates={baseDates}
        onDateChange={onDateChange}
        mode="draft"
        whatIfActive={false}
        onToggleWhatIf={vi.fn()}
      />,
    )
    const d = new Date('2026-05-01')
    captured.Trade!(d)
    expect(onDateChange).toHaveBeenCalledWith('trade', d)
  })

  test('Eff EditableDate onChange fires onDateChange("effective", d)', () => {
    const onDateChange = vi.fn()
    render(
      <TopBar
        swapType="IRS"
        onTypeChange={vi.fn()}
        dates={baseDates}
        onDateChange={onDateChange}
        mode="draft"
        whatIfActive={false}
        onToggleWhatIf={vi.fn()}
      />,
    )
    captured.Eff!(new Date('2026-06-01'))
    expect(onDateChange).toHaveBeenCalledWith('effective', expect.any(Date))
  })

  test('Mat EditableDate onChange fires onDateChange("maturity", d)', () => {
    const onDateChange = vi.fn()
    render(
      <TopBar
        swapType="IRS"
        onTypeChange={vi.fn()}
        dates={baseDates}
        onDateChange={onDateChange}
        mode="draft"
        whatIfActive={false}
        onToggleWhatIf={vi.fn()}
      />,
    )
    captured.Mat!(new Date('2027-06-01'))
    expect(onDateChange).toHaveBeenCalledWith('maturity', expect.any(Date))
  })

  test('EditableTenor onChange fires onDateChange("tenor", t)', () => {
    const onDateChange = vi.fn()
    render(
      <TopBar
        swapType="IRS"
        onTypeChange={vi.fn()}
        dates={baseDates}
        onDateChange={onDateChange}
        mode="draft"
        whatIfActive={false}
        onToggleWhatIf={vi.fn()}
      />,
    )
    captured.tenor!({ years: 2, months: 0 })
    expect(onDateChange).toHaveBeenCalledWith('tenor', { years: 2, months: 0 })
  })
})
