import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

vi.mock('@/shared/contexts/ledger-context', () => ({
  useLedger: () => ({
    client: { query: vi.fn() },
    activeOrg: { id: 'goldman' },
  }),
}))

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: { query: vi.fn() }, activeParty: 'Operator' }),
}))

vi.mock('../../ledger/manual-lifecycle', () => ({
  manualTriggerLifecycle: vi.fn().mockResolvedValue(undefined),
}))

const FIXTURES: Record<string, unknown[]> = { current: [] }

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useQuery: () => ({ data: FIXTURES.current, isLoading: false }),
  }
})

import { ManualFixingsPicker } from '../manual-fixings-picker'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient()
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function fakeWorkflow(overrides: { contractId: string; swapType: string }) {
  return {
    contractId: overrides.contractId,
    payload: {
      swapType: overrides.swapType,
      operator: 'Operator',
      partyA: 'PartyA::1',
      partyB: 'PartyB::2',
      regulators: ['Regulator'],
      scheduler: 'Scheduler',
      instrumentKey: { id: { unpack: 'inst-1' } },
      notional: '5000000',
    },
  }
}

beforeEach(() => {
  FIXTURES.current = []
})
afterEach(() => cleanup())

describe('ManualFixingsPicker', () => {
  test('healthy state: shows disabled button with rationale', () => {
    const { container } = wrap(<ManualFixingsPicker stalled={false} />)
    expect(container.querySelector('[data-testid="manual-fixings-healthy"]')).not.toBeNull()
    const btn = container.querySelector('[data-testid="publish-fixing-btn"]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  test('stalled + no workflows: shows empty state', () => {
    FIXTURES.current = []
    const { container } = wrap(<ManualFixingsPicker stalled={true} />)
    expect(container.querySelector('[data-testid="manual-fixings-empty"]')).not.toBeNull()
  })

  test('CCY workflow renders a Trigger button (manualEligible)', () => {
    FIXTURES.current = [fakeWorkflow({ contractId: 'ccy-cid-001-aaa', swapType: 'CCY' })]
    const { container } = wrap(<ManualFixingsPicker stalled={true} />)
    expect(container.querySelector('[data-testid^="manual-fixings-trigger-"]')).not.toBeNull()
  })

  test('IRS workflow shows Workspace link instead of Trigger', () => {
    FIXTURES.current = [fakeWorkflow({ contractId: 'irs-cid-001-bbb', swapType: 'IRS' })]
    const { container } = wrap(<ManualFixingsPicker stalled={true} />)
    expect(container.querySelector('[data-testid^="manual-fixings-trigger-"]')).toBeNull()
    const link = container.querySelector('a[href*="workspace?swap=irs-cid-001-bbb"]')
    expect(link).not.toBeNull()
  })

  test('clicking Trigger opens dialog with cid prefilled and read-only', () => {
    FIXTURES.current = [fakeWorkflow({ contractId: 'ccy-cid-001-aaa', swapType: 'CCY' })]
    const { container } = wrap(<ManualFixingsPicker stalled={true} />)
    const trigger = container.querySelector(
      '[data-testid^="manual-fixings-trigger-"]',
    ) as HTMLButtonElement
    fireEvent.click(trigger)
    const readonly = container.querySelector('[data-testid="manual-trigger-cid-readonly"]')
    expect(readonly?.textContent).toBe('ccy-cid-001-aaa')
    // Free-text input should NOT be present while locked
    expect(container.querySelector('[data-testid="manual-trigger-swap-cid"]')).toBeNull()
    // Change button should let operator unlock and edit
    const change = container.querySelector(
      '[data-testid="manual-trigger-change-cid"]',
    ) as HTMLButtonElement
    expect(change).not.toBeNull()
    fireEvent.click(change)
    expect(container.querySelector('[data-testid="manual-trigger-swap-cid"]')).not.toBeNull()
  })
})
