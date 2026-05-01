import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { RightPanel } from '../right-panel'

afterEach(() => cleanup())

vi.mock('canton-party-directory/react', () => ({
  usePartyDirectory: () => ({
    directory: {
      entries: () => [
        { hint: 'PartyB', displayName: 'Citi' },
        { hint: 'Operator', displayName: 'Op' },
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
vi.mock('@/shared/hooks/use-is-operator', () => ({
  useIsOperator: () => false,
  useIsRegulator: () => false,
}))
vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => ({ config: { observables: { ASSET: { enabled: true } } } }),
}))
vi.mock('../on-chain-panel', () => ({
  OnChainPanel: ({ onOpenUnwindModal }: { onOpenUnwindModal: () => void }) => (
    <div>
      <button onClick={onOpenUnwindModal}>open-unwind</button>
    </div>
  ),
}))
vi.mock('../tab-strip', () => ({
  TabStrip: ({
    tabs,
    active,
    onChange,
    children,
  }: {
    tabs: { key: string; label: string }[]
    active: string
    onChange: (k: string) => void
    children: React.ReactNode
  }) => (
    <div>
      {tabs.map((t) => (
        <button key={t.key} data-active={t.key === active} onClick={() => onChange(t.key)}>
          tab-{t.key}
        </button>
      ))}
      {children}
    </div>
  ),
}))
vi.mock('../valuation-tab', () => ({ ValuationTab: () => <div data-testid="valuation-tab" /> }))
vi.mock('../risk-tab', () => ({ RiskTab: () => <div data-testid="risk-tab" /> }))
vi.mock('../solver-tab', () => ({ SolverTab: () => <div data-testid="solver-tab" /> }))
vi.mock('../reference-strip', () => ({
  ReferenceStrip: () => <div data-testid="reference-strip" />,
  ReferenceStripSkeleton: () => <div data-testid="reference-strip-skeleton" />,
}))
vi.mock('../attribution-drawer', () => ({
  AttributionDrawer: () => <div data-testid="attribution-drawer" />,
}))
vi.mock('../unwind-modal', () => ({
  UnwindModal: ({
    isOpen,
    onClose,
    onSubmit,
  }: {
    isOpen: boolean
    onClose: () => void
    onSubmit: (pv: number, reason: string) => Promise<void>
  }) =>
    isOpen ? (
      <div data-testid="unwind-modal">
        <button onClick={onClose}>close-unwind</button>
        <button onClick={() => onSubmit(100, 'r')}>submit-unwind</button>
      </div>
    ) : null,
}))

const baseProps = {
  valuation: null,
  curve: null,
  swapStatus: null,
  proposalRole: null,
  contractId: null,
  counterparty: '',
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
  currentNpv: 123,
  onProposeTerminate: vi.fn().mockResolvedValue(undefined),
  swapConfig: null,
  pricingCtx: null,
  curveHistory: [],
  streamStatus: 'idle' as const,
  activeParty: 'PartyA',
}

describe('RightPanel — extra interactions', () => {
  test('tab change from valuation → risk renders RiskTab', () => {
    const { container, queryByTestId } = render(<RightPanel {...baseProps} mode="draft" />)
    expect(queryByTestId('valuation-tab')).not.toBeNull()
    const riskTab = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'tab-risk',
    )!
    fireEvent.click(riskTab)
    expect(queryByTestId('risk-tab')).not.toBeNull()
  })

  test('tab change from valuation → solver renders SolverTab', () => {
    const { container, queryByTestId } = render(<RightPanel {...baseProps} mode="draft" />)
    const solverTab = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'tab-solver',
    )!
    fireEvent.click(solverTab)
    expect(queryByTestId('solver-tab')).not.toBeNull()
  })

  test('unwind modal: OnChainPanel opens it, close button dismisses it', () => {
    const { container, queryByTestId } = render(<RightPanel {...baseProps} mode="active" />)
    expect(queryByTestId('unwind-modal')).toBeNull()
    const openBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'open-unwind',
    )!
    fireEvent.click(openBtn)
    expect(queryByTestId('unwind-modal')).not.toBeNull()
    const closeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'close-unwind',
    )!
    fireEvent.click(closeBtn)
    expect(queryByTestId('unwind-modal')).toBeNull()
  })

  test('unwind modal submit forwards (pvAmount, reason) through onProposeTerminate', async () => {
    const onProposeTerminate = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <RightPanel {...baseProps} mode="active" onProposeTerminate={onProposeTerminate} />,
    )
    const openBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'open-unwind',
    )!
    fireEvent.click(openBtn)
    const submitBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'submit-unwind',
    )!
    fireEvent.click(submitBtn)
    await Promise.resolve()
    expect(onProposeTerminate).toHaveBeenCalledWith({ pvAmount: 100, reason: 'r' })
  })
})
