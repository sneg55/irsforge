import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'

// --- module-level mocks (before imports) ---

let mockLastTick: Date | null = new Date()
let mockCurves: import('../../hooks/use-curve-staleness').CurveStalenessEntry[] = []

vi.mock('@/shared/scheduler/use-last-tick', () => ({
  useLastTick: () => mockLastTick,
}))

vi.mock('@/shared/scheduler/scheduler-status-pill', () => ({
  SchedulerStatusPill: () => <span data-testid="scheduler-pill">Scheduler OK</span>,
}))

vi.mock('../../hooks/use-curve-staleness', () => ({
  useCurveStaleness: () => ({
    entries: mockCurves,
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/shared/contexts/ledger-context', () => ({
  useLedger: () => ({ client: null, activeParty: null, activeOrg: null }),
}))

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: null, activeParty: null }),
}))

vi.mock('../../ledger/manual-lifecycle', () => ({
  manualTriggerLifecycle: vi.fn().mockResolvedValue(undefined),
}))

import { HealthCard } from '../health-card'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function freshTick(): Date {
  return new Date(Date.now() - 10_000) // 10s ago — healthy
}

function stalledTick(): Date {
  return new Date(Date.now() - 400_000) // 6.6m ago — past 5m threshold
}

describe('HealthCard', () => {
  it('renders SchedulerStatusPill', () => {
    mockLastTick = freshTick()
    mockCurves = []
    const { container } = wrap(<HealthCard />)
    const pill = container.querySelector('[data-testid="scheduler-pill"]')
    expect(pill).not.toBeNull()
  })

  it('renders one row per curve from useCurveStaleness', () => {
    mockLastTick = freshTick()
    mockCurves = [
      {
        ccy: 'USD',
        curveType: 'Discount',
        indexId: null,
        lastPublishedAt: new Date(Date.now() - 5 * 60 * 1000),
        ageMinutes: 5,
        stale: false,
      },
      {
        ccy: 'EUR',
        curveType: 'Discount',
        indexId: null,
        lastPublishedAt: new Date(Date.now() - 15 * 60 * 1000),
        ageMinutes: 15,
        stale: true,
      },
    ]
    const { container } = wrap(<HealthCard />)
    const rows = container.querySelectorAll('[data-testid^="curve-row-"]')
    expect(rows.length).toBe(2)
  })

  it('stale rows have bg-red class', () => {
    mockLastTick = freshTick()
    mockCurves = [
      {
        ccy: 'EUR',
        curveType: 'Discount',
        indexId: null,
        lastPublishedAt: new Date(Date.now() - 20 * 60 * 1000),
        ageMinutes: 20,
        stale: true,
      },
    ]
    const { container } = wrap(<HealthCard />)
    const row = container.querySelector('[data-testid="curve-row-EUR:Discount:"]')
    expect(row).not.toBeNull()
    expect(row!.className).toContain('red')
  })

  it('publish fixing button is disabled when scheduler is healthy', () => {
    mockLastTick = freshTick()
    mockCurves = []
    const { container } = wrap(<HealthCard />)
    const btn = container.querySelector('[data-testid="publish-fixing-btn"]') as HTMLButtonElement
    expect(btn).not.toBeNull()
    expect(btn.disabled).toBe(true)
  })

  it('replaces the disabled button with the manual fixings picker when stalled', () => {
    mockLastTick = stalledTick()
    mockCurves = []
    const { container } = wrap(<HealthCard />)
    // No client in this test → picker query is disabled → empty state.
    expect(container.querySelector('[data-testid="manual-fixings-empty"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="manual-fixings-healthy"]')).toBeNull()
  })
})
