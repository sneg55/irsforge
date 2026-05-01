import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import WorkspacePage from '../page'

// Shape of the workspace hook's return we drive the page with.
const workspaceState = {
  mode: 'active' as 'active' | 'whatif' | 'draft',
  swapType: 'IRS' as 'IRS' | 'CDS' | 'CCY' | 'FX' | 'FpML',
  legs: [
    { legType: 'fixed', notional: 1_000_000, direction: 'pay' },
    { legType: 'float', notional: 1_000_000, direction: 'receive' },
  ] as unknown[],
  dates: { startDate: new Date(), maturityDate: new Date() },
  contractId: null,
  workflowContractId: null,
  workflowInstrument: null,
  swapStatus: null,
  proposalRole: null,
  counterparty: '',
  swapConfig: null,
  draftId: null,
  outstandingEffectsCount: 0,
  isPastMaturity: false,
  pendingUnwind: null,
  unwindRole: null,
  creditSpread: 0.02,
  notionalLinked: true,
  proposeTerminate: vi.fn(),
  setSwapType: vi.fn(),
  updateLeg: vi.fn(),
  setLegNotional: vi.fn(),
  toggleNotionalLink: vi.fn(),
  updateDateField: vi.fn(),
  toggleDirection: vi.fn(),
  toggleWhatIf: vi.fn(),
  setCounterparty: vi.fn(),
  addLeg: vi.fn(),
  removeLeg: vi.fn(),
  setCreditSpread: vi.fn(),
  propose: vi.fn(),
  exerciseAction: vi.fn(),
}

vi.mock('../hooks/use-workspace', () => ({
  useWorkspace: () => workspaceState,
}))

const pricingInputs = {
  curve: { id: 'stub' } as unknown,
  floatingRateIndex: null,
  secondFloatingRateIndex: null,
  indicesByLeg: undefined,
  observations: [],
  curveBook: null,
  fxSpots: {},
  pricingCtx: null,
  curveHistory: [],
  streamStatus: 'idle',
}
vi.mock('../hooks/use-pricing-inputs', () => ({
  usePricingInputs: () => pricingInputs,
}))

const valuationState: { valuation: unknown } = { valuation: null }
vi.mock('../hooks/use-pricing', () => ({
  usePricing: () => valuationState,
}))

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: null, activeParty: 'PartyA', partyDisplayName: 'A' }),
}))

vi.mock('@/shared/layout/footer-slot-context', () => ({
  useSetFooterSlot: vi.fn(),
}))

// Stub heavy children — we care about the page's own branching (swap-type grid,
// what-if banner, LegComposer vs LegColumn) not their internals.
vi.mock('../components/top-bar', () => ({
  TopBar: ({ swapType }: { swapType: string }) => <div data-testid="topbar">{swapType}</div>,
}))
vi.mock('../components/leg-column', () => ({
  LegColumn: ({ legIndex }: { legIndex: number }) => <div data-testid={`leg-${legIndex}`} />,
}))
vi.mock('../components/leg-composer', () => ({
  LegComposer: () => <div data-testid="leg-composer" />,
}))
vi.mock('../components/right-panel', () => ({
  RightPanel: () => <div data-testid="right-panel" />,
  RightPanelSkeleton: () => <div data-testid="right-panel-skeleton" />,
}))
vi.mock('../components/what-if-banner', () => ({
  WhatIfBanner: ({
    originalNPV,
    scenarioNPV,
  }: {
    originalNPV: number | null
    scenarioNPV: number | null
  }) => (
    <div
      data-testid="whatif-banner"
      data-orig={String(originalNPV)}
      data-scenario={String(scenarioNPV)}
    />
  ),
}))
vi.mock('../components/cds-panel', () => ({
  CdsPanel: () => <div data-testid="cds-panel" />,
}))

beforeEach(() => {
  workspaceState.mode = 'active'
  workspaceState.swapType = 'IRS'
  workspaceState.legs = [
    { legType: 'fixed', notional: 1_000_000, direction: 'pay' },
    { legType: 'float', notional: 1_000_000, direction: 'receive' },
  ]
  valuationState.valuation = null
})
afterEach(() => cleanup())

describe('WorkspacePage', () => {
  test('IRS mode renders two LegColumns + RightPanel, no CdsPanel, no composer', () => {
    const { queryByTestId } = render(<WorkspacePage />)
    expect(queryByTestId('topbar')?.textContent).toBe('IRS')
    expect(queryByTestId('leg-0')).not.toBeNull()
    expect(queryByTestId('leg-1')).not.toBeNull()
    expect(queryByTestId('right-panel')).not.toBeNull()
    expect(queryByTestId('cds-panel')).toBeNull()
    expect(queryByTestId('leg-composer')).toBeNull()
  })

  test('CDS mode renders the CdsPanel above legs', () => {
    workspaceState.swapType = 'CDS'
    const { queryByTestId } = render(<WorkspacePage />)
    expect(queryByTestId('cds-panel')).not.toBeNull()
    expect(queryByTestId('leg-0')).not.toBeNull()
  })

  test('FpML mode switches to LegComposer and hides per-leg columns', () => {
    workspaceState.swapType = 'FpML'
    const { queryByTestId } = render(<WorkspacePage />)
    expect(queryByTestId('leg-composer')).not.toBeNull()
    expect(queryByTestId('leg-0')).toBeNull()
  })

  test('what-if mode shows the banner and captures original NPV on first render', () => {
    workspaceState.mode = 'whatif'
    valuationState.valuation = { npv: 1234, cashflows: [], legPVs: [] }
    const { queryByTestId } = render(<WorkspacePage />)
    expect(queryByTestId('whatif-banner')).not.toBeNull()
    const banner = queryByTestId('whatif-banner')!
    expect(banner.getAttribute('data-scenario')).toBe('1234')
  })

  test('active mode does NOT render the what-if banner', () => {
    workspaceState.mode = 'active'
    const { queryByTestId } = render(<WorkspacePage />)
    expect(queryByTestId('whatif-banner')).toBeNull()
  })

  test('renders only leg-0 when legs array has a single entry', () => {
    workspaceState.legs = [{ legType: 'fixed', notional: 1_000_000, direction: 'pay' }]
    const { queryByTestId } = render(<WorkspacePage />)
    expect(queryByTestId('leg-0')).not.toBeNull()
    expect(queryByTestId('leg-1')).toBeNull()
  })
})
