import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LedgerActivityEvent } from '../../types'
import { LedgerEventDrawer } from '../ledger-event-drawer'

const events: LedgerActivityEvent[] = [
  {
    kind: 'create',
    templateId: 'IRSForge:Swap:SwapWorkflow',
    contractId: '00a',
    party: null,
    ts: 1,
    payload: { counterparty: 'BankA', notional: 1_000_000 },
  },
  {
    kind: 'archive',
    templateId: 'IRSForge:Swap:SwapWorkflow',
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

  it('shows raw payload when enabled', () => {
    render(
      <LedgerEventDrawer cid="00a" events={events} rawPayloadEnabled={true} onClose={vi.fn()} />,
    )
    expect(screen.getByText(/BankA/)).toBeTruthy()
  })

  it('hides raw payload when disabled', () => {
    render(
      <LedgerEventDrawer cid="00a" events={events} rawPayloadEnabled={false} onClose={vi.fn()} />,
    )
    expect(screen.queryByText(/BankA/)).toBeNull()
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
