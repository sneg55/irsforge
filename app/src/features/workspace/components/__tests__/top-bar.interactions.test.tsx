import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { ObservablesConfig } from '../../types'
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
  ImportFpmlModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="fpml-modal">
      <button onClick={onClose}>close-modal</button>
    </div>
  ),
}))

const isOperatorMock = vi.fn(() => false)
const isRegulatorMock = vi.fn(() => false)
vi.mock('@/shared/hooks/use-is-operator', () => ({
  useIsOperator: () => isOperatorMock(),
  useIsRegulator: () => isRegulatorMock(),
}))

const observables: ObservablesConfig = {
  IRS: { rateIds: ['SOFR/ON'], kind: 'periodic-fixing', enabled: true },
  OIS: { rateIds: ['SOFR/ON'], kind: 'periodic-fixing', enabled: true },
  BASIS: { rateIds: ['SOFR/ON'], kind: 'periodic-fixing', enabled: true },
  XCCY: { rateIds: ['SOFR/ON'], kind: 'periodic-fixing', enabled: true },
  CDS: {
    rateIdPattern: 'CDS/{refName}/{DefaultProb|Recovery}',
    kind: 'credit-event',
    enabled: true,
  },
  CCY: { rateIds: [], kind: 'none', enabled: true },
  FX: { rateIds: [], kind: 'none', enabled: true },
  ASSET: { rateIdPattern: 'ASSET/{assetId}', kind: 'price', enabled: true },
  FpML: { rateIds: [], kind: 'embedded', enabled: true },
}

const baseDates: WorkspaceDates = {
  tradeDate: new Date('2026-04-15'),
  effectiveDate: new Date('2026-04-15'),
  maturityDate: new Date('2027-04-15'),
  tenor: { years: 1, months: 0 },
  anchor: 'tenor',
  effManuallySet: false,
}

describe('TopBar interactions', () => {
  beforeEach(() => {
    mockUseConfig.mockReset()
    mockUseConfig.mockReturnValue({
      config: { observables },
      loading: false,
      getOrg: () => undefined,
    })
  })

  test('clicking a product tab fires onTypeChange in draft mode', () => {
    const onTypeChange = vi.fn()
    const { container } = render(
      <TopBar
        swapType="IRS"
        onTypeChange={onTypeChange}
        dates={baseDates}
        onDateChange={vi.fn()}
        mode="draft"
        whatIfActive={false}
        onToggleWhatIf={vi.fn()}
      />,
    )
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'CDS',
    )!
    fireEvent.click(btn)
    expect(onTypeChange).toHaveBeenCalledWith('CDS')
  })

  test('clicking a disabled product tab in view mode does NOT fire onTypeChange', () => {
    const onTypeChange = vi.fn()
    const { container } = render(
      <TopBar
        swapType="IRS"
        onTypeChange={onTypeChange}
        dates={baseDates}
        onDateChange={vi.fn()}
        mode="active"
        whatIfActive={false}
        onToggleWhatIf={vi.fn()}
      />,
    )
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'CDS',
    )!
    fireEvent.click(btn)
    expect(onTypeChange).not.toHaveBeenCalled()
  })

  test('Import FpML button opens and closes the modal', () => {
    const { container, queryByTestId } = render(
      <TopBar
        swapType="IRS"
        onTypeChange={vi.fn()}
        dates={baseDates}
        onDateChange={vi.fn()}
        mode="draft"
        whatIfActive={false}
        onToggleWhatIf={vi.fn()}
      />,
    )
    expect(queryByTestId('fpml-modal')).toBeNull()
    const openBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Import FpML',
    )!
    fireEvent.click(openBtn)
    expect(queryByTestId('fpml-modal')).not.toBeNull()

    const closeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'close-modal',
    )!
    fireEvent.click(closeBtn)
    expect(queryByTestId('fpml-modal')).toBeNull()
  })

  test('Import FpML button is hidden for operator account', () => {
    isOperatorMock.mockReturnValueOnce(true)
    const { container } = render(
      <TopBar
        swapType="IRS"
        onTypeChange={vi.fn()}
        dates={baseDates}
        onDateChange={vi.fn()}
        mode="draft"
        whatIfActive={false}
        onToggleWhatIf={vi.fn()}
      />,
    )
    const btn = container.querySelector('[data-testid="import-fpml-btn"]')
    expect(btn).toBeNull()
  })

  test('Import FpML button is hidden for regulator account', () => {
    isRegulatorMock.mockReturnValueOnce(true)
    const { container } = render(
      <TopBar
        swapType="IRS"
        onTypeChange={vi.fn()}
        dates={baseDates}
        onDateChange={vi.fn()}
        mode="draft"
        whatIfActive={false}
        onToggleWhatIf={vi.fn()}
      />,
    )
    const btn = container.querySelector('[data-testid="import-fpml-btn"]')
    expect(btn).toBeNull()
  })

  test('Import FpML button is hidden outside draft mode', () => {
    const { container } = render(
      <TopBar
        swapType="IRS"
        onTypeChange={vi.fn()}
        dates={baseDates}
        onDateChange={vi.fn()}
        mode="active"
        whatIfActive={false}
        onToggleWhatIf={vi.fn()}
      />,
    )
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Import FpML',
    )
    expect(btn).toBeUndefined()
  })

  test('What-If toggle fires onToggleWhatIf in non-draft mode', () => {
    const onToggleWhatIf = vi.fn()
    const { container } = render(
      <TopBar
        swapType="IRS"
        onTypeChange={vi.fn()}
        dates={baseDates}
        onDateChange={vi.fn()}
        mode="active"
        whatIfActive={false}
        onToggleWhatIf={onToggleWhatIf}
      />,
    )
    // The What-If toggle is the only round-capsule button — find by class.
    const toggle = Array.from(container.querySelectorAll('button')).find((b) =>
      b.className.includes('rounded-full'),
    )!
    fireEvent.click(toggle)
    expect(onToggleWhatIf).toHaveBeenCalledTimes(1)
  })

  test('does not render What-If toggle in draft mode', () => {
    const { container } = render(
      <TopBar
        swapType="IRS"
        onTypeChange={vi.fn()}
        dates={baseDates}
        onDateChange={vi.fn()}
        mode="draft"
        whatIfActive={false}
        onToggleWhatIf={vi.fn()}
      />,
    )
    expect(container.textContent).not.toContain('WHAT-IF')
  })
})
