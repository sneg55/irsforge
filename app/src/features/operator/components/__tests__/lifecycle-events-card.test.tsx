import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

vi.mock('@/shared/contexts/ledger-context', () => ({
  useLedger: () => ({
    client: { query: vi.fn() },
    activeOrg: { id: 'goldman' },
  }),
}))

// Pick a date 30 days out so it falls inside the LOOKAHEAD_DAYS=90 window.
const FUTURE_DATE = (() => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 30)
  return d.toISOString().slice(0, 10)
})()

const FAKE_WORKFLOW = {
  contractId: 'cid-abc-123-def',
  payload: {
    swapType: 'IRS',
    partyA: 'PartyA::1',
    partyB: 'PartyB::2',
    notional: '10000000',
    instrumentKey: { id: { unpack: 'instr-1' } },
  },
}

const FAKE_INSTRUMENT = {
  swapType: 'IRS',
  payload: {
    periodicSchedule: { terminationDate: FUTURE_DATE },
  },
}

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useQuery: () => ({ data: [FAKE_WORKFLOW], isLoading: false }),
  }
})

vi.mock('@/shared/hooks/use-swap-instruments', () => ({
  useSwapInstruments: () => ({
    byInstrumentId: new Map([['instr-1', FAKE_INSTRUMENT]]),
    isLoading: false,
  }),
}))

import { LifecycleEventsCard } from '../lifecycle-events-card'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient()
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  pushMock.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('LifecycleEventsCard row navigation', () => {
  test('clicking a maturity row routes to workspace?swap=<cid>', () => {
    const { container } = wrap(<LifecycleEventsCard />)
    const row = container.querySelector(
      '[data-testid^="lifecycle-row-"]:not([data-testid^="lifecycle-row-link"])',
    ) as HTMLElement
    expect(row).not.toBeNull()
    fireEvent.click(row)
    expect(pushMock).toHaveBeenCalledWith('/org/goldman/workspace?swap=cid-abc-123-def')
  })

  test('clicking the ledger link does not double-fire workspace navigation', () => {
    const { container } = wrap(<LifecycleEventsCard />)
    const link = container.querySelector('a[href*="/ledger?cid="]') as HTMLAnchorElement
    expect(link).not.toBeNull()
    fireEvent.click(link)
    expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining('/workspace'))
  })

  test('row is keyboard activatable via Enter', () => {
    const { container } = wrap(<LifecycleEventsCard />)
    const row = container.querySelector('[data-testid^="lifecycle-row-"]') as HTMLElement
    expect(row).not.toBeNull()
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(pushMock).toHaveBeenCalledWith('/org/goldman/workspace?swap=cid-abc-123-def')
  })
})
