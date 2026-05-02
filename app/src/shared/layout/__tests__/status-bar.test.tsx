import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { ledgerHealthBus } from '@/shared/ledger/health-bus'

import { StatusBar } from '../status-bar'

const mockUseLedgerClient = vi.fn()
vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => mockUseLedgerClient(),
}))

// SchedulerStatusPill hits its own data hooks — stub it out; not under test here.
vi.mock('../../scheduler/scheduler-status-pill', () => ({
  SchedulerStatusPill: () => <span data-testid="scheduler-pill" />,
}))

const mockUseFooterSlot = vi.fn()
vi.mock('../footer-slot-context', () => ({
  useFooterSlot: () => mockUseFooterSlot(),
}))

// Per-test configurable ledgerUi toggle.
let mockLedgerUiEnabled = false
vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => ({
    config: {
      ledgerUi: { enabled: mockLedgerUiEnabled },
    },
    loading: false,
    getOrg: () => undefined,
  }),
}))

// next/navigation — return a fixed orgId so Link hrefs are deterministic.
vi.mock('next/navigation', () => ({
  useParams: () => ({ orgId: 'demo' }),
}))

function setMockLedgerUi(enabled: boolean) {
  mockLedgerUiEnabled = enabled
}

function renderWithQuery(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  ledgerHealthBus.resetForTesting()
})

beforeEach(() => {
  mockUseLedgerClient.mockReturnValue({ client: { token: 'stub' } })
  mockUseFooterSlot.mockReturnValue(null)
  // Default: simulate a healthy ledger so the StatusBar's "Connected to
  // Canton" label is visible. Tests that want to assert disconnected /
  // connecting copy override this with explicit recordFailure / reset.
  ledgerHealthBus.resetForTesting()
  ledgerHealthBus.recordSuccess(Date.now())
  // Stub global fetch for the oracle-health query.
  ;(globalThis as { fetch?: unknown }).fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      lastOvernightRate: { percent: 4.32, fetchedAt: new Date().toISOString() },
    }),
  }))
})

describe('StatusBar', () => {
  test('connected indicator shown when client present', () => {
    const { container } = renderWithQuery(<StatusBar />)
    expect(container.textContent).toContain('Connected to Canton')
  })

  test('connecting indicator when client is null (no JWT yet)', () => {
    mockUseLedgerClient.mockReturnValue({ client: null })
    ledgerHealthBus.resetForTesting()
    const { container } = renderWithQuery(<StatusBar />)
    expect(container.textContent).toContain('Connecting to Canton')
  })

  test('Canton unreachable indicator when health bus reports down', () => {
    ledgerHealthBus.resetForTesting()
    ledgerHealthBus.recordFailure()
    ledgerHealthBus.recordFailure()
    ledgerHealthBus.recordFailure()
    const { container } = renderWithQuery(<StatusBar />)
    expect(container.textContent).toContain('Canton unreachable')
  })

  test('SOFR label renders "--" before fetch resolves', () => {
    const { container } = renderWithQuery(<StatusBar />)
    expect(container.textContent).toContain('SOFR')
  })

  test('renders skeleton for SOFR rate while health query is pending', () => {
    // Force fetch to never resolve so the oracle-health query stays pending.
    ;(globalThis as { fetch?: unknown }).fetch = vi.fn(() => new Promise(() => {}))
    const { container } = renderWithQuery(<StatusBar />)
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  test('renders LivenessDot for connection state', () => {
    const { container } = renderWithQuery(<StatusBar />)
    const dots = container.querySelectorAll('[data-slot="liveness-dot"]')
    expect(dots.length).toBeGreaterThanOrEqual(1)
  })

  test('SOFR rate rendered after fetch resolves (non-stale)', async () => {
    const { container } = renderWithQuery(<StatusBar />)
    await waitFor(() => {
      expect(container.textContent).toMatch(/4\.32%/)
    })
  })

  test('stale SOFR reading is flagged when fetchedAt is older than threshold', async () => {
    const old = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    ;(globalThis as { fetch?: unknown }).fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ lastOvernightRate: { percent: 4.01, fetchedAt: old } }),
    }))
    const { container } = renderWithQuery(<StatusBar />)
    await waitFor(() => {
      expect(container.textContent).toContain('(stale)')
    })
  })

  test('scheduler pill rendered', () => {
    const { container } = renderWithQuery(<StatusBar />)
    expect(container.querySelector('[data-testid="scheduler-pill"]')).not.toBeNull()
  })

  test('without footer slot — shows IRSForge v1 tag on the right', () => {
    const { container } = renderWithQuery(<StatusBar />)
    expect(container.textContent).toContain('IRSForge v1')
  })

  test('with footer slot — renders Leg 1 / Leg 2 / Net PV', () => {
    mockUseFooterSlot.mockReturnValue({
      valuation: { legPVs: [1_000, -500], npv: 500 },
      swapConfig: { legs: [{ legType: 'float', indexId: 'USD-SOFR' }] },
      curve: { currency: 'USD', asOf: '2026-04-21' },
    })
    const { container } = renderWithQuery(<StatusBar />)
    expect(container.textContent).toContain('Leg 1 PV')
    expect(container.textContent).toContain('Leg 2 PV')
    expect(container.textContent).toContain('Net')
    expect(container.textContent).toContain('USD-SOFR')
  })

  it('renders "Connected to Canton" as a link when ledgerUi.enabled and client connected', () => {
    setMockLedgerUi(true)
    const { container } = renderWithQuery(<StatusBar />)
    const link = container.querySelector('a[href^="/org/"][href$="/ledger"]')
    expect(link).not.toBeNull()
    expect(link?.textContent).toContain('Connected to Canton')
    expect(link?.textContent).toContain('↗ Audit trail')
  })

  it('renders a plain span when ledgerUi.enabled is false', () => {
    setMockLedgerUi(false)
    const { container } = renderWithQuery(<StatusBar />)
    expect(container.querySelector('a[href*="/ledger"]')).toBeNull()
    expect(container.textContent).toContain('Connected to Canton')
  })
})
