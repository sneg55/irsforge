import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import WorkspacePage from '../page'

const workspaceState = {
  mode: 'active' as 'active' | 'whatif' | 'draft',
  swapType: 'FpML' as 'IRS' | 'CDS' | 'CCY' | 'FX' | 'FpML',
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

vi.mock('../hooks/use-pricing-inputs', () => ({
  // Curve is non-null so page.tsx renders RightPanel (not RightPanelSkeleton),
  // which these tests capture props from. Real DiscountCurve shape isn't
  // needed because RightPanel itself is mocked below.
  usePricingInputs: () => ({
    curve: {} as unknown,
    floatingRateIndex: null,
    secondFloatingRateIndex: null,
    indicesByLeg: undefined,
    observations: [],
    curveBook: null,
    fxSpots: {},
    pricingCtx: null,
    curveHistory: [],
    streamStatus: 'idle',
  }),
}))
vi.mock('../hooks/use-pricing', () => ({
  usePricing: () => ({ valuation: null }),
}))
vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: null, activeParty: 'PartyA', partyDisplayName: 'A' }),
}))
vi.mock('@/shared/layout/footer-slot-context', () => ({
  useSetFooterSlot: vi.fn(),
}))
vi.mock('../components/top-bar', () => ({
  TopBar: () => <div data-testid="topbar" />,
}))
// Capture props of LegColumn and LegComposer, and fire callbacks.
const capturedComposer: { onUpdateLeg?: (i: number, f: string, v: unknown) => void } = {}
vi.mock('../components/leg-composer', () => ({
  LegComposer: (props: { onUpdateLeg: (i: number, f: string, v: unknown) => void }) => {
    capturedComposer.onUpdateLeg = props.onUpdateLeg
    return <div data-testid="leg-composer" />
  },
}))
const capturedLegCol: { onUpdateLeg?: (f: string, v: unknown) => void } = {}
vi.mock('../components/leg-column', () => ({
  LegColumn: (props: { onUpdateLeg: (f: string, v: unknown) => void }) => {
    capturedLegCol.onUpdateLeg = props.onUpdateLeg
    return <div data-testid="leg-col" />
  },
}))
const capturedRight: { onApplyLegPatch?: (i: number, p: Record<string, unknown>) => void } = {}
vi.mock('../components/right-panel', () => ({
  RightPanel: (props: { onApplyLegPatch?: (i: number, p: Record<string, unknown>) => void }) => {
    capturedRight.onApplyLegPatch = props.onApplyLegPatch
    return <div data-testid="right-panel" />
  },
  RightPanelSkeleton: () => <div data-testid="right-panel-skeleton" />,
}))
vi.mock('../components/what-if-banner', () => ({
  WhatIfBanner: () => <div data-testid="whatif-banner" />,
}))
vi.mock('../components/cds-panel', () => ({
  CdsPanel: () => <div data-testid="cds-panel" />,
}))

beforeEach(() => {
  Object.values(workspaceState).forEach((v) => {
    if (typeof v === 'function' && 'mockClear' in v) (v as { mockClear: () => void }).mockClear()
  })
  workspaceState.swapType = 'FpML'
  workspaceState.mode = 'active'
})
afterEach(() => cleanup())

describe('WorkspacePage inline callbacks', () => {
  test('LegComposer.onUpdateLeg forwards to workspace.updateLeg', () => {
    render(<WorkspacePage />)
    expect(capturedComposer.onUpdateLeg).toBeTypeOf('function')
    capturedComposer.onUpdateLeg!(0, 'rate', 0.05)
    expect(workspaceState.updateLeg).toHaveBeenCalledWith(0, 'rate', 0.05)
  })

  test('RightPanel.onApplyLegPatch loops entries into workspace.updateLeg', () => {
    render(<WorkspacePage />)
    expect(capturedRight.onApplyLegPatch).toBeTypeOf('function')
    capturedRight.onApplyLegPatch!(1, { rate: 0.04, spread: 0.001 })
    expect(workspaceState.updateLeg).toHaveBeenCalledWith(1, 'rate', 0.04)
    expect(workspaceState.updateLeg).toHaveBeenCalledWith(1, 'spread', 0.001)
  })

  test('IRS: LegColumn.onUpdateLeg forwards per-leg field updates', () => {
    workspaceState.swapType = 'IRS'
    render(<WorkspacePage />)
    capturedLegCol.onUpdateLeg!('rate', 0.07)
    expect(workspaceState.updateLeg).toHaveBeenCalledWith(1, 'rate', 0.07)
  })

  test('CDS mode renders CdsPanel alongside legs', () => {
    workspaceState.swapType = 'CDS'
    const { queryByTestId } = render(<WorkspacePage />)
    expect(queryByTestId('cds-panel')).not.toBeNull()
  })
})
