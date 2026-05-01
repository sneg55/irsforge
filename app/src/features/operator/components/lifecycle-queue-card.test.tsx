import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OperatorQueueItem } from '../hooks/use-operator-queue'

// Mock the hook before importing the card
vi.mock('../hooks/use-operator-queue-stream', () => ({
  useOperatorQueueStream: vi.fn(),
}))

// Empty-state copy reads on-ledger OperatorPolicy contracts to render the
// "X auto · Y manual" posture line. Default to no rows (= all-auto via the
// hook fallback) unless a specific test overrides the mock.
const useOperatorPoliciesMock = vi.fn(() => ({
  rows: [] as Array<{ contractId: string; family: string; mode: 'auto' | 'manual' }>,
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: () => {},
}))
vi.mock('../hooks/use-operator-policies', () => ({
  useOperatorPolicies: () => useOperatorPoliciesMock(),
}))

// QueueRow is rendered by the card — mock it to keep this test focused on card logic
vi.mock('./queue-row', () => ({
  QueueRow: ({ item }: { item: OperatorQueueItem }) => (
    <div data-testid="queue-row" data-id={item.id}>
      {item.title}
    </div>
  ),
}))

import { useOperatorQueueStream } from '../hooks/use-operator-queue-stream'
import { LifecycleQueueCard } from './lifecycle-queue-card'

const mockedUseOperatorQueue = vi.mocked(useOperatorQueueStream)

function queueResult(partial: {
  items?: OperatorQueueItem[]
  isLoading?: boolean
  isError?: boolean
  error?: Error | null
}) {
  return {
    items: partial.items ?? [],
    isLoading: partial.isLoading ?? false,
    isError: partial.isError ?? false,
    error: partial.error ?? null,
    refetch: vi.fn(),
  }
}

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const SAMPLE_ITEMS: OperatorQueueItem[] = [
  {
    type: 'dispute',
    id: 'dispute-1',
    title: 'CSA PartyA–PartyB: dispute',
    subtitle: 'Mark disputed — operator adjudication required',
    deepLinkHref: '/org/demo/csa?pair=x',
    sortKey: 100,
  },
  {
    type: 'accept-ack',
    id: 'accept-ack-1',
    title: 'IRS proposal — BankA → BankB: awaiting co-sign',
    subtitle: 'IRS proposal — awaiting co-sign',
    deepLinkHref: '/org/demo/workspace?proposal=y',
    sortKey: 50,
    contractId: 'irs-ack-cid-1',
    family: 'IRS',
  },
  {
    type: 'lifecycle',
    id: 'lifecycle-1',
    title: 'IRS fixing due',
    subtitle: 'Scheduled fixing event',
    deepLinkHref: '/org/demo/workspace?swap=z',
    sortKey: 20,
  },
]

describe('LifecycleQueueCard', () => {
  it('renders empty state when hook returns no items', () => {
    mockedUseOperatorQueue.mockReturnValue(queueResult({ items: [], isLoading: false }))

    const { container } = wrap(<LifecycleQueueCard />)

    const emptyState = container.querySelector('[data-testid="operator-queue-empty"]')
    expect(emptyState).not.toBeNull()
    expect(emptyState?.textContent).toContain('No pending actions')

    const rows = container.querySelectorAll('[data-testid="queue-row"]')
    expect(rows.length).toBe(0)
  })

  it('empty state surfaces the all-auto policy posture (default)', () => {
    useOperatorPoliciesMock.mockReturnValueOnce({
      rows: [],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: () => {},
    })
    mockedUseOperatorQueue.mockReturnValue(queueResult({ items: [], isLoading: false }))
    const { container } = wrap(<LifecycleQueueCard />)
    const text = container.querySelector('[data-testid="operator-queue-empty"]')?.textContent ?? ''
    expect(text).toContain('All 9 families on auto-policy')
    // CSA dispute count now lives in its own row outside the empty-state block.
    const disputeCount = container
      .querySelector('[data-testid="csa-dispute-count"]')
      ?.textContent?.trim()
    expect(disputeCount).toBe('0')
  })

  it('empty state shows mixed posture when some families are on manual policy', () => {
    useOperatorPoliciesMock.mockReturnValueOnce({
      rows: [
        { contractId: 'cid-irs', family: 'IRS', mode: 'manual' },
        { contractId: 'cid-cds', family: 'CDS', mode: 'manual' },
      ],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: () => {},
    })
    mockedUseOperatorQueue.mockReturnValue(queueResult({ items: [], isLoading: false }))
    const { container } = wrap(<LifecycleQueueCard />)
    const text = container.querySelector('[data-testid="operator-queue-empty"]')?.textContent ?? ''
    expect(text).toContain('7 auto')
    expect(text).toContain('2 manual')
  })

  it('renders 3 rows when hook returns 3 items', () => {
    mockedUseOperatorQueue.mockReturnValue(queueResult({ items: SAMPLE_ITEMS, isLoading: false }))

    const { container } = wrap(<LifecycleQueueCard />)

    const rows = container.querySelectorAll('[data-testid="queue-row"]')
    expect(rows.length).toBe(3)
    expect(rows[0].getAttribute('data-id')).toBe('dispute-1')
    expect(rows[1].getAttribute('data-id')).toBe('accept-ack-1')
    expect(rows[2].getAttribute('data-id')).toBe('lifecycle-1')
  })

  it('renders skeleton rows when isLoading is true, not the empty state', () => {
    mockedUseOperatorQueue.mockReturnValue(queueResult({ items: [], isLoading: true }))

    const { container } = wrap(<LifecycleQueueCard />)

    const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)

    // Should NOT show empty state text during loading
    const text = container.textContent ?? ''
    expect(text).not.toContain('No pending actions')
  })

  it('shows item count in the header when not loading', () => {
    mockedUseOperatorQueue.mockReturnValue(queueResult({ items: SAMPLE_ITEMS, isLoading: false }))

    const { container } = wrap(<LifecycleQueueCard />)

    expect(container.textContent).toContain('3 items')
  })

  it('shows singular "item" when count is 1', () => {
    mockedUseOperatorQueue.mockReturnValue(
      queueResult({ items: [SAMPLE_ITEMS[0]], isLoading: false }),
    )

    const { container } = wrap(<LifecycleQueueCard />)

    expect(container.textContent).toContain('1 item')
    expect(container.textContent).not.toContain('1 items')
  })
})
