import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { ObservablesConfig } from '../../types'
import type { WorkspaceDates } from '../../utils/date-recalc'
import { TopBar } from '../top-bar'

afterEach(() => cleanup())

const mockUseConfig = vi.fn()
vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => mockUseConfig(),
}))

const baseObservables: ObservablesConfig = {
  IRS: { rateIds: ['SOFR/ON'], kind: 'periodic-fixing', enabled: true },
  OIS: { rateIds: ['SOFR/ON'], kind: 'periodic-fixing', enabled: true },
  BASIS: { rateIds: ['SOFR/ON'], kind: 'periodic-fixing', enabled: false },
  XCCY: { rateIds: ['SOFR/ON'], kind: 'periodic-fixing', enabled: false },
  CDS: {
    rateIdPattern: 'CDS/{refName}/{DefaultProb|Recovery}',
    kind: 'credit-event',
    enabled: true,
  },
  CCY: { rateIds: [], kind: 'none', enabled: true },
  FX: { rateIds: [], kind: 'none', enabled: true },
  ASSET: { rateIdPattern: 'ASSET/{assetId}', kind: 'price', enabled: false },
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

function renderTopBar(
  observables: ObservablesConfig,
  swapType: 'IRS' | 'OIS' | 'ASSET' | 'CDS' = 'IRS',
) {
  mockUseConfig.mockReturnValue({
    config: { observables },
    loading: false,
    getOrg: () => undefined,
  })
  return render(
    <TopBar
      swapType={swapType}
      onTypeChange={vi.fn()}
      dates={baseDates}
      onDateChange={vi.fn()}
      mode="draft"
      whatIfActive={false}
      onToggleWhatIf={vi.fn()}
    />,
  )
}

describe('TopBar observables filtering', () => {
  beforeEach(() => {
    mockUseConfig.mockReset()
  })

  test('hides disabled products from the selector — ASSET (default off) is absent', () => {
    renderTopBar(baseObservables)
    // SWAP_TYPE_CONFIGS.ASSET.shortLabel === 'ASSET' per constants.ts
    expect(screen.queryByRole('button', { name: 'ASSET' })).toBeNull()
    expect(screen.getByRole('button', { name: 'IRS' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'CDS' })).toBeTruthy()
  })

  test('keeps the currently-selected swap type visible even when disabled', () => {
    // A user viewing an existing ASSET swap should still see the ASSET tab
    // active — hiding it would strand them on a blank header.
    renderTopBar(baseObservables, 'ASSET')
    expect(screen.getByRole('button', { name: 'ASSET' })).toBeTruthy()
  })

  test('hides IRS when disabled', () => {
    const obs: ObservablesConfig = {
      ...baseObservables,
      IRS: { ...baseObservables.IRS, enabled: false },
    }
    renderTopBar(obs, 'CDS')
    expect(screen.queryByRole('button', { name: 'IRS' })).toBeNull()
  })

  test('renders every product while config is still loading (avoids layout flash)', () => {
    mockUseConfig.mockReturnValue({ config: null, loading: true, getOrg: () => undefined })
    render(
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
    for (const t of ['IRS', 'OIS', 'BASIS', 'XCCY', 'CDS', 'CCY', 'FX', 'ASSET', 'FpML']) {
      expect(screen.getByRole('button', { name: t })).toBeTruthy()
    }
  })
})
