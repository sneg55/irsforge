import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { OnChainPanel } from '../on-chain-panel'

afterEach(() => cleanup())

// PartyName is a purely cosmetic renderer from canton-party-directory/ui; stub it
// so the tests can run without a real directory provider.
vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

const mockUseFlags = vi.fn()
vi.mock('@/shared/flags/use-flags', () => ({
  useFlags: () => mockUseFlags(),
}))

beforeEach(() => {
  // Default: demo behaviour (manual buttons visible). Individual tests
  // override when they need to assert the production-profile gating.
  mockUseFlags.mockReturnValue({
    schedulerEnabled: false,
    schedulerManualOverridesEnabled: true,
  })
})

const baseProps = {
  swapStatus: 'Active' as const,
  proposalRole: null,
  contractId: 'cid-123',
  counterparty: 'PartyB',
  fixingsOutstanding: 0,
  fixingsTotal: 4,
  nextFixingDate: '04/20/26',
  hasOutstandingEffects: false,
  isPastMaturity: false,
  swapType: 'IRS' as const,
  assetObservablesEnabled: false,
  pendingUnwind: null,
  unwindRole: null,
  workflowInstrument: null,
  workflowRegulators: [] as readonly string[],
  workflowNotional: '10000000',
  onExerciseAction: vi.fn(),
  onOpenUnwindModal: vi.fn(),
}

describe('OnChainPanel role-aware filter', () => {
  test('hides TRIGGER FIXING and Mature from non-operator on Active', () => {
    render(<OnChainPanel {...baseProps} isOperator={false} />)
    expect(screen.queryByRole('button', { name: /trigger fixing/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^mature$/i })).toBeNull()
    // Post / Withdraw moved to /csa + workspace CSA tab in Phase 5 Stage C.
    expect(screen.getByRole('button', { name: /unwind/i })).toBeTruthy()
  })

  test('shows TRIGGER FIXING to operator on Active', () => {
    render(<OnChainPanel {...baseProps} isOperator={true} />)
    expect(screen.getByRole('button', { name: /trigger fixing/i })).toBeTruthy()
  })

  test('operator still only sees Mature when past maturity', () => {
    const { rerender } = render(
      <OnChainPanel {...baseProps} isOperator={true} isPastMaturity={false} />,
    )
    expect(screen.queryByRole('button', { name: /^mature$/i })).toBeNull()
    rerender(<OnChainPanel {...baseProps} isOperator={true} isPastMaturity={true} />)
    expect(screen.getByRole('button', { name: /^mature$/i })).toBeTruthy()
  })

  test('hides Settle from non-operator on PendingSettlement', () => {
    render(
      <OnChainPanel
        {...baseProps}
        swapStatus={'PendingSettlement' as const}
        hasOutstandingEffects={true}
        isOperator={false}
      />,
    )
    expect(screen.queryByRole('button', { name: /^settle$/i })).toBeNull()
  })

  test('renders Outstanding / Total label with amber highlight when > 0', () => {
    // jest-dom matchers are unreliable in the current vitest 4.x/jsdom setup;
    // assert via raw DOM instead.
    const { rerender, container } = render(
      <OnChainPanel {...baseProps} isOperator={true} fixingsOutstanding={0} fixingsTotal={4} />,
    )
    expect(container.textContent).toContain('Outstanding')
    const valueSpan = () =>
      Array.from(container.querySelectorAll('span.font-mono')).find((n) =>
        / \/ /.test(n.textContent ?? ''),
      )
    expect(valueSpan()?.textContent).toBe('0 / 4')
    // 0 outstanding → neutral white, not the amber call-to-action colour.
    expect(valueSpan()?.className).toContain('text-white')
    expect(valueSpan()?.className).not.toContain('#f59e0b')

    rerender(
      <OnChainPanel {...baseProps} isOperator={true} fixingsOutstanding={1} fixingsTotal={4} />,
    )
    expect(valueSpan()?.textContent).toBe('1 / 4')
    // 1 outstanding → amber (Settle is the user's next action).
    expect(valueSpan()?.className).toContain('#f59e0b')
  })

  test('hides TriggerLifecycle / Settle / Mature when manual overrides disabled (Phase 6 production profile)', () => {
    mockUseFlags.mockReturnValue({
      schedulerEnabled: true,
      schedulerManualOverridesEnabled: false,
    })
    render(
      <OnChainPanel
        {...baseProps}
        isOperator={true}
        isPastMaturity={true}
        hasOutstandingEffects={true}
      />,
    )
    expect(screen.queryByRole('button', { name: /trigger fixing/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^settle$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^mature$/i })).toBeNull()
    // Unwind is trader-controllered (terminateProposal/propose) and is hidden
    // for operators regardless of scheduler flag — they can't be a partyA/B.
    expect(screen.queryByRole('button', { name: /unwind/i })).toBeNull()
  })

  test('hides trader-controllered actions (Unwind) for operator account', () => {
    // Active swap, operator viewing — TriggerLifecycle/Settle/Mature stay
    // (operator-controllered) but Unwind goes away (trader-controllered).
    render(<OnChainPanel {...baseProps} isOperator={true} />)
    expect(screen.queryByRole('button', { name: /unwind/i })).toBeNull()
  })

  test('keeps manual buttons visible when manual overrides enabled (demo profile)', () => {
    mockUseFlags.mockReturnValue({
      schedulerEnabled: true,
      schedulerManualOverridesEnabled: true,
    })
    render(<OnChainPanel {...baseProps} isOperator={true} />)
    expect(screen.getByRole('button', { name: /trigger fixing/i })).toBeTruthy()
  })

  test('Outstanding label carries tooltip explaining the counter', () => {
    const { container } = render(<OnChainPanel {...baseProps} isOperator={false} />)
    const node = container.querySelector('[data-tooltip-key="outstanding"]')
    expect(node?.getAttribute('title')).toMatch(/awaiting Settle/i)
  })

  test('Active status pill carries tooltip', () => {
    const { container } = render(<OnChainPanel {...baseProps} isOperator={false} />)
    const node = container.querySelector('[data-tooltip-key="status-active"]')
    expect(node?.getAttribute('title')).toMatch(/live and accruing/i)
  })

  test('renders Regulator-visible pill when workflowRegulators is non-empty', () => {
    const { container } = render(
      <OnChainPanel {...baseProps} isOperator={false} workflowRegulators={['Regulator::abc']} />,
    )
    expect(container.querySelector('[data-testid="regulator-visibility-pill"]')).not.toBeNull()
  })

  test('hides Regulator-visible pill when workflowRegulators is empty', () => {
    const { container } = render(<OnChainPanel {...baseProps} isOperator={false} />)
    expect(container.querySelector('[data-testid="regulator-visibility-pill"]')).toBeNull()
  })

  test('Next Fixing label carries tooltip', () => {
    const { container } = render(<OnChainPanel {...baseProps} isOperator={false} />)
    const node = container.querySelector('[data-tooltip-key="next-fixing"]')
    expect(node?.getAttribute('title')).toMatch(/scheduled rate fixing/i)
  })

  test('shows Settle to operator only when outstanding effects exist', () => {
    const { rerender } = render(
      <OnChainPanel
        {...baseProps}
        swapStatus={'PendingSettlement' as const}
        hasOutstandingEffects={false}
        isOperator={true}
      />,
    )
    expect(screen.queryByRole('button', { name: /^settle$/i })).toBeNull()
    rerender(
      <OnChainPanel
        {...baseProps}
        swapStatus={'PendingSettlement' as const}
        hasOutstandingEffects={true}
        isOperator={true}
      />,
    )
    expect(screen.getByRole('button', { name: /^settle$/i })).toBeTruthy()
  })
})
