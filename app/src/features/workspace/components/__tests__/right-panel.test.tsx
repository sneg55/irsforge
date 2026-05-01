import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { RightPanel } from '../right-panel'

// --- Mock every child component and heavy hook this panel composes. We only
// verify wiring (which children render in which mode + callback plumbing).

vi.mock('canton-party-directory/react', () => ({
  usePartyDirectory: () => ({
    directory: {
      entries: () => [
        { hint: 'PartyB', displayName: 'Citi' },
        { hint: 'Operator', displayName: 'Op' },
        { hint: 'Regulator', displayName: 'Reg' },
      ],
    },
  }),
}))

vi.mock('@/features/csa/hooks/use-csa-summary', () => ({
  useCsaSummary: () => ({
    count: 0,
    configured: false,
    ownPosted: 0,
    cptyPosted: 0,
    exposure: null,
    state: 'Active',
    regulatorHints: [],
    phase: 'initial',
    isFetching: false,
  }),
}))

const isOperatorMock = vi.fn(() => false)
const isRegulatorMock = vi.fn(() => false)
vi.mock('@/shared/hooks/use-is-operator', () => ({
  useIsOperator: () => isOperatorMock(),
  useIsRegulator: () => isRegulatorMock(),
}))

vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => ({ config: { observables: { ASSET: { enabled: true } } } }),
}))

vi.mock('../unwind-modal', () => ({
  UnwindModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="unwind-modal" /> : null,
}))

vi.mock('../on-chain-panel', () => ({
  OnChainPanel: () => <div data-testid="on-chain-panel" />,
}))

vi.mock('../tab-strip', () => ({
  TabStrip: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tab-strip">{children}</div>
  ),
}))

vi.mock('../valuation-tab', () => ({
  ValuationTab: () => <div data-testid="valuation-tab" />,
}))

vi.mock('../risk-tab', () => ({
  RiskTab: () => <div data-testid="risk-tab" />,
}))

vi.mock('../solver-tab', () => ({
  SolverTab: () => <div data-testid="solver-tab" />,
}))

vi.mock('../reference-strip', () => ({
  ReferenceStrip: () => <div data-testid="reference-strip" />,
  ReferenceStripSkeleton: () => <div data-testid="reference-strip-skeleton" />,
}))

vi.mock('../attribution-drawer', () => ({
  AttributionDrawer: () => <div data-testid="attribution-drawer" />,
}))

afterEach(() => cleanup())

const baseProps = {
  valuation: null,
  curve: null,
  swapStatus: null,
  proposalRole: null,
  contractId: null,
  counterparty: '',
  mode: 'draft' as const,
  swapType: 'IRS' as const,
  onExerciseAction: async () => {},
  onPropose: () => {},
  onCounterpartyChange: () => {},
  fixingsOutstanding: 0,
  fixingsTotal: 0,
  nextFixingDate: '',
  pendingUnwind: null,
  unwindRole: null,
  workflowInstrument: null,
  workflowNotional: '',
  currentNpv: null,
  onProposeTerminate: async () => {},
  swapConfig: null,
  pricingCtx: null,
  curveHistory: [],
  streamStatus: 'idle' as const,
  activeParty: 'PartyA',
}

describe('RightPanel — draft mode', () => {
  test('renders PROPOSE SWAP section with counterparty select', () => {
    const { container } = render(<RightPanel {...baseProps} />)
    expect(container.textContent).toContain('PROPOSE SWAP')
    expect(container.textContent).toContain('Counterparty')
    // Operator + Regulator filtered out — only PartyB/Citi remains.
    const opts = Array.from(container.querySelectorAll('option')).map((o) => o.textContent)
    expect(opts).toContain('Citi')
    expect(opts).not.toContain('Op')
    expect(opts).not.toContain('Reg')
  })

  test('PROPOSE button disabled without counterparty, enabled once set', () => {
    const { container, rerender } = render(<RightPanel {...baseProps} />)
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'PROPOSE',
    ) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    rerender(<RightPanel {...baseProps} counterparty="PartyB" />)
    const btn2 = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'PROPOSE',
    ) as HTMLButtonElement
    expect(btn2.disabled).toBe(false)
  })

  test('clicking PROPOSE fires onPropose', () => {
    const onPropose = vi.fn()
    const { container } = render(
      <RightPanel {...baseProps} counterparty="PartyB" onPropose={onPropose} />,
    )
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'PROPOSE',
    )!
    fireEvent.click(btn)
    expect(onPropose).toHaveBeenCalledTimes(1)
  })

  test('counterparty select change fires onCounterpartyChange', () => {
    const onCounterpartyChange = vi.fn()
    const { container } = render(
      <RightPanel {...baseProps} onCounterpartyChange={onCounterpartyChange} />,
    )
    const select = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'PartyB' } })
    expect(onCounterpartyChange).toHaveBeenCalledWith('PartyB')
  })

  test('draft mode hides AttributionDrawer (only renders for non-draft)', () => {
    const { container } = render(<RightPanel {...baseProps} />)
    expect(container.querySelector('[data-testid="attribution-drawer"]')).toBeNull()
  })

  test('operator account: PROPOSE block replaced with explanatory copy, no PROPOSE button', () => {
    isOperatorMock.mockReturnValue(true)
    const { container } = render(<RightPanel {...baseProps} />)
    const blocked = container.querySelector('[data-testid="propose-blocked-operator"]')
    expect(blocked).not.toBeNull()
    expect(blocked!.textContent).toMatch(/Operators don.t propose swaps/)
    const proposeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'PROPOSE',
    )
    expect(proposeBtn).toBeUndefined()
    isOperatorMock.mockReturnValue(false)
  })

  test('regulator account: PROPOSE block shown with regulator copy, no PROPOSE button', () => {
    isRegulatorMock.mockReturnValue(true)
    const { container } = render(<RightPanel {...baseProps} />)
    const blocked = container.querySelector('[data-testid="propose-blocked-operator"]')
    expect(blocked).not.toBeNull()
    expect(blocked!.textContent).toMatch(/Regulators observe swaps/)
    const proposeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'PROPOSE',
    )
    expect(proposeBtn).toBeUndefined()
    isRegulatorMock.mockReturnValue(false)
  })

  test('valuation tab is the default; child renders', () => {
    const { container } = render(<RightPanel {...baseProps} />)
    expect(container.querySelector('[data-testid="valuation-tab"]')).not.toBeNull()
  })

  test('ReferenceStrip renders skeleton when curve=null and history=[]', () => {
    const { container } = render(<RightPanel {...baseProps} />)
    // Initial-load proxy: no curve + no history shows the skeleton.
    expect(container.querySelector('[data-testid="reference-strip-skeleton"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="reference-strip"]')).toBeNull()
  })

  test('ReferenceStrip renders once curve is available', () => {
    const curve = {
      currency: 'USD',
      curveType: 'Discount' as const,
      indexId: null,
      asOf: '2026-04-15T00:00:00Z',
      pillars: [],
      interpolation: 'LinearZero' as const,
      dayCount: 'Act360' as const,
    }
    const { container } = render(<RightPanel {...baseProps} curve={curve} />)
    expect(container.querySelector('[data-testid="reference-strip"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="reference-strip-skeleton"]')).toBeNull()
  })
})

describe('RightPanel — live (non-draft) mode', () => {
  test('renders OnChainPanel instead of PROPOSE section', () => {
    const { container } = render(<RightPanel {...baseProps} mode="active" />)
    expect(container.querySelector('[data-testid="on-chain-panel"]')).not.toBeNull()
    expect(container.textContent).not.toContain('PROPOSE SWAP')
  })

  test('renders AttributionDrawer in live mode', () => {
    const { container } = render(<RightPanel {...baseProps} mode="active" />)
    expect(container.querySelector('[data-testid="attribution-drawer"]')).not.toBeNull()
  })
})
