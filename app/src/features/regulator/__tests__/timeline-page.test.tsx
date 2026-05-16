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
  // After B2 (audit), filter chips render human labels like "Mark posted",
  // which collide with the event-row text. Scope these assertions to event
  // rows by matching the cid that only the event card renders.
  const rowText = (re: RegExp) =>
    screen.queryAllByText(re).filter((el) => el.closest('[data-slot="timeline-card"]') !== null)

  it('renders non-system events by default; hides system events', () => {
    render(<TimelinePage />)
    expect(rowText(/IRS accepted/).length).toBeGreaterThan(0)
    expect(rowText(/Mark posted/).length).toBeGreaterThan(0)
    expect(rowText(/Oracle rate published/).length).toBe(0)
  })

  it('shows system events when toggle is enabled', () => {
    render(<TimelinePage />)
    fireEvent.click(screen.getByText('Include system events'))
    expect(rowText(/Oracle rate published/).length).toBeGreaterThan(0)
  })

  it('event-type filter narrows to selected kinds', () => {
    render(<TimelinePage />)
    // Click the chip by aria-label so we don't accidentally hit an event row.
    const chip = document.querySelector('button[aria-label="filter-TradeAccepted"]')
    if (!chip) throw new Error('TradeAccepted filter chip not found')
    fireEvent.click(chip)
    expect(rowText(/IRS accepted/).length).toBeGreaterThan(0)
    expect(rowText(/Mark posted/).length).toBe(0)
  })
})
