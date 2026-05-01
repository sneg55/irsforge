import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BusinessEvent } from '../timeline/business-events'
import { TimelinePage } from '../timeline/page'

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

vi.mock('canton-party-directory/react', () => ({
  usePartyDirectory: () => ({ displayName: (id: string) => id, loading: false }),
}))

const mockEvents: BusinessEvent[] = [
  {
    kind: 'TradeAccepted',
    family: 'IRS',
    partyA: 'PartyA',
    partyB: 'PartyB',
    notional: 100_000_000,
    cid: 'wf1',
    ts: Date.now(),
  },
  {
    kind: 'MarkPosted',
    partyA: 'PartyA',
    partyB: 'PartyB',
    exposure: 1234.56,
    asOf: 'now',
    cid: 'mk1',
    ts: Date.now() - 5000,
  },
  { kind: 'OracleRatePublished', templateName: 'Observation', cid: 'obs1', ts: Date.now() - 10000 },
]

vi.mock('../hooks/use-business-events', () => ({
  useBusinessEvents: () => ({ events: mockEvents, phase: 'streaming' }),
}))

describe('TimelinePage', () => {
  it('renders non-system events by default; hides system events', () => {
    render(<TimelinePage />)
    expect(screen.queryByText(/IRS accepted/)).not.toBe(null)
    expect(screen.queryByText(/Mark posted/)).not.toBe(null)
    expect(screen.queryByText(/Oracle rate published/)).toBe(null)
  })

  it('shows system events when toggle is enabled', () => {
    render(<TimelinePage />)
    fireEvent.click(screen.getByText('Include system events'))
    expect(screen.queryByText(/Oracle rate published/)).not.toBe(null)
  })

  it('event-type filter narrows to selected kinds', () => {
    render(<TimelinePage />)
    fireEvent.click(screen.getByText('TradeAccepted'))
    expect(screen.queryByText(/IRS accepted/)).not.toBe(null)
    expect(screen.queryByText(/Mark posted/)).toBe(null)
  })
})
