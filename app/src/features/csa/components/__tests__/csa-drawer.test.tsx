import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier.split('::')[0]}</span>,
}))
vi.mock('@/shared/ledger/party-match', () => ({
  partyMatchesHint: (party: string, hint: string) => party.split('::')[0] === hint.split('::')[0],
  hintFromParty: (p: string) => p.split('::')[0],
}))
vi.mock('@/shared/hooks/use-is-operator', () => ({
  isOperatorParty: (p: string) => p.startsWith('Operator'),
  isRegulatorParty: (p: string) => p.startsWith('Regulator'),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/org/goldman/csa',
}))

// Hook mutables — each test sets these before render so we don't need to
// re-mock per test.
const mockMarkStream = {
  history: [] as Array<{ asOf: string; exposure: number }>,
  latest: null as null | { asOf: string; exposure: number },
  status: 'streaming' as 'streaming' | 'idle' | 'reconnecting',
}
vi.mock('../../hooks/use-mark-stream', () => ({
  useMarkStream: () => mockMarkStream,
}))
vi.mock('../../hooks/use-dispute-record', () => ({
  useDisputeRecord: () => ({ data: null }),
}))

// Funding actions is the consumer we care about for the prefill prop;
// a stub captures the props so we can assert on them without rendering
// the real modal tree.
const fundingActionsProps: Record<string, unknown>[] = []
vi.mock('../csa-funding-actions', () => ({
  CsaFundingActions: (props: Record<string, unknown>) => {
    fundingActionsProps.push(props)
    return <div data-testid="funding-actions" />
  },
}))
// Operator + dispute counterparty actions are off-path for the trader case.
vi.mock('../csa-operator-actions', () => ({
  CsaOperatorActions: () => <div data-testid="operator-actions" />,
}))
vi.mock('../dispute-counterparty-actions', () => ({
  DisputeCounterpartyActions: () => <div data-testid="dispute-cp-actions" />,
}))
vi.mock('../mark-sparkline', () => ({
  MarkSparkline: () => <div data-testid="mark-sparkline" />,
}))
vi.mock('../netted-batch-history', () => ({
  NettedBatchHistory: () => <div data-testid="netted-batches" />,
}))

import type { CsaViewModel } from '../../decode'
import { CsaDrawer } from '../csa-drawer'

afterEach(() => {
  cleanup()
  fundingActionsProps.length = 0
  mockMarkStream.history = []
  mockMarkStream.latest = null
  mockMarkStream.status = 'streaming'
})

const baseCsa: CsaViewModel = {
  contractId: 'cid-1',
  partyA: 'Goldman::1220abcd',
  partyB: 'JPMorgan::1220ef01',
  state: 'MarginCallOutstanding',
  thresholdDirA: 0,
  thresholdDirB: 0,
  mta: 100_000,
  rounding: 10_000,
  valuationCcy: 'USD',
  postedByA: new Map([['USD', 5_000_000]]),
  postedByB: new Map(),
  eligible: [],
  isdaMasterAgreementRef: '',
  governingLaw: 'NewYork',
  imAmount: 0,
  activeDispute: null,
  // biome-ignore lint/suspicious/noExplicitAny: minimal viewmodel for the drawer test
} as any

function renderDrawer(activeParty: string, csa: CsaViewModel = baseCsa) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CsaDrawer csa={csa} activeParty={activeParty} />
    </QueryClientProvider>,
  )
}

describe('CsaDrawer — outstandingCallAmount + counterpartyHasOpenCall plumbing', () => {
  test('passes the call amount when the active party IS the funder', () => {
    // Exposure of -8.64M against zero thresholds and 5M already posted by A.
    // gateCall(target - current) = -13.64M; side = B (JPM owes).
    // JPMorgan IS the funder → prefill applies.
    mockMarkStream.latest = { asOf: '2026-05-15T12:00:00Z', exposure: -8_640_000 }
    renderDrawer('JPMorgan')
    expect(fundingActionsProps).toHaveLength(1)
    expect(fundingActionsProps[0]!['outstandingCallAmount']).toBe(13_640_000)
    expect(fundingActionsProps[0]!['counterpartyHasOpenCall']).toBe(false)
  })

  test('passes null + counterpartyHasOpenCall when active party is NOT the funder', () => {
    // Same exposure, but Goldman (= A) is not the funder. Without this gate,
    // posting from Goldman doubled the call (the bug fixed by this commit).
    mockMarkStream.latest = { asOf: '2026-05-15T12:00:00Z', exposure: -8_640_000 }
    renderDrawer('Goldman')
    expect(fundingActionsProps[0]!['outstandingCallAmount']).toBeNull()
    expect(fundingActionsProps[0]!['counterpartyHasOpenCall']).toBe(true)
  })

  test('passes null + no warning when there is no mark yet (latest = null)', () => {
    mockMarkStream.latest = null
    renderDrawer('Goldman')
    expect(fundingActionsProps[0]!['outstandingCallAmount']).toBeNull()
    expect(fundingActionsProps[0]!['counterpartyHasOpenCall']).toBe(false)
  })

  test('passes null + no warning when the call gates to zero (within MTA)', () => {
    // Exposure 50k below the 100k MTA; gateCall returns 0; no prefill, no warning.
    mockMarkStream.latest = { asOf: '2026-05-15T12:00:00Z', exposure: 50_000 }
    renderDrawer('Goldman', { ...baseCsa, postedByA: new Map(), postedByB: new Map() })
    expect(fundingActionsProps[0]!['outstandingCallAmount']).toBeNull()
    expect(fundingActionsProps[0]!['counterpartyHasOpenCall']).toBe(false)
  })
})

describe('CsaDrawer — role gating', () => {
  test('trader sees CsaFundingActions, not the operator/regulator surfaces', () => {
    const { container } = renderDrawer('Goldman')
    expect(container.querySelector('[data-testid="funding-actions"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="operator-actions"]')).toBeNull()
  })

  test('operator sees CsaOperatorActions, not the funding actions', () => {
    const { container } = renderDrawer('Operator')
    expect(container.querySelector('[data-testid="operator-actions"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="funding-actions"]')).toBeNull()
  })

  test('regulator sees neither actions surface (read-only oversight)', () => {
    const { container } = renderDrawer('Regulator')
    expect(container.querySelector('[data-testid="operator-actions"]')).toBeNull()
    expect(container.querySelector('[data-testid="funding-actions"]')).toBeNull()
    expect(container.querySelector('[data-testid="dispute-cp-actions"]')).toBeNull()
  })

  test('hides the "View trades" link for operator and regulator', () => {
    const trader = renderDrawer('Goldman')
    expect(trader.container.querySelector('[data-testid="csa-view-trades-link"]')).not.toBeNull()
    cleanup()
    const operator = renderDrawer('Operator')
    expect(operator.container.querySelector('[data-testid="csa-view-trades-link"]')).toBeNull()
    cleanup()
    const regulator = renderDrawer('Regulator')
    expect(regulator.container.querySelector('[data-testid="csa-view-trades-link"]')).toBeNull()
  })
})

describe('CsaDrawer — latest mark display', () => {
  test('renders the latest exposure formatted in the valuation currency', () => {
    mockMarkStream.latest = { asOf: '2026-05-15T12:00:00Z', exposure: -8_640_000 }
    const { container } = renderDrawer('Goldman')
    expect(container.textContent).toMatch(/-\$8,640,000/)
  })

  test('renders an em-dash when there is no mark yet', () => {
    mockMarkStream.latest = null
    const { container } = renderDrawer('Goldman')
    expect(container.textContent).toContain('Latest:')
    expect(container.textContent).toContain('—')
  })
})
