import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LedgerActivityEvent } from '../../types'
import { LedgerEventDrawer } from '../ledger-event-drawer'

vi.mock('next/navigation', () => ({
  useParams: () => ({ orgId: 'demo' }),
}))

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

const events: LedgerActivityEvent[] = [
  {
    kind: 'create',
    templateId: 'IRSForge:Swap.Workflow:SwapWorkflow',
    contractId: '00a',
    party: null,
    ts: 1,
    payload: {
      swapType: 'IRS',
      partyA: 'Alice::ns',
      partyB: 'Bob::ns',
      notional: '1000000',
      operator: 'Operator::ns',
      scheduler: 'Sched::ns',
      regulators: ['SEC::ns'],
    },
  },
  {
    kind: 'archive',
    templateId: 'IRSForge:Swap.Workflow:SwapWorkflow',
    contractId: '00a',
    party: null,
    ts: 2,
  },
]

describe('LedgerEventDrawer', () => {
  it('renders nothing when cid is null', () => {
    const { container } = render(
      <LedgerEventDrawer cid={null} events={events} rawPayloadEnabled={true} onClose={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders related events for the cid', () => {
    render(
      <LedgerEventDrawer cid="00a" events={events} rawPayloadEnabled={true} onClose={vi.fn()} />,
    )
    expect(screen.getByText(/create/i)).toBeTruthy()
    expect(screen.getByText(/archive/i)).toBeTruthy()
  })

  it('renders the human-readable summary (labels + formatted notional)', () => {
    render(
      <LedgerEventDrawer cid="00a" events={events} rawPayloadEnabled={true} onClose={vi.fn()} />,
    )
    expect(screen.getByText('Swap workflow')).toBeTruthy()
    expect(screen.getByText('Notional')).toBeTruthy()
    // formatted with thousands separator + 2 decimals
    expect(screen.getByText('1,000,000.00')).toBeTruthy()
    // partyA was resolved through MaybeParty + the PartyName mock
    expect(screen.getAllByText('Alice::ns').length).toBeGreaterThan(0)
  })

  it('keeps raw JSON behind a collapsed details block when enabled', () => {
    render(
      <LedgerEventDrawer cid="00a" events={events} rawPayloadEnabled={true} onClose={vi.fn()} />,
    )
    expect(screen.getByText(/Raw JSON/i)).toBeTruthy()
  })

  it('hides raw JSON when rawPayload is disabled but still shows the summary', () => {
    render(
      <LedgerEventDrawer cid="00a" events={events} rawPayloadEnabled={false} onClose={vi.fn()} />,
    )
    expect(screen.queryByText(/Raw JSON/i)).toBeNull()
    expect(screen.getByText('Swap workflow')).toBeTruthy()
  })

  it('shows empty-buffer message when cid is unknown', () => {
    render(
      <LedgerEventDrawer cid="00zzz" events={events} rawPayloadEnabled={true} onClose={vi.fn()} />,
    )
    expect(screen.getByText(/No buffered activity/i)).toBeTruthy()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(
      <LedgerEventDrawer cid="00a" events={events} rawPayloadEnabled={true} onClose={onClose} />,
    )
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
