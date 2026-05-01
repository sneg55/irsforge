import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LedgerActivityEvent } from '../../types'
import { LedgerEventTable } from '../ledger-event-table'

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

const events: LedgerActivityEvent[] = [
  {
    kind: 'create',
    templateId: 'IRSForge:Swap:SwapWorkflow',
    contractId: '00a',
    party: null,
    ts: 1,
  },
  {
    kind: 'exercise',
    templateId: 'IRSForge:Csa.Csa:Csa',
    contractId: '00b',
    party: 'Alice',
    ts: 2,
    choice: 'PostMargin',
  },
]

describe('LedgerEventTable', () => {
  it('renders one row per event (plus header)', () => {
    render(<LedgerEventTable events={events} onRowClick={vi.fn()} />)
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(rows[1].textContent).toContain('create')
    expect(rows[2].textContent).toContain('exercise')
    expect(rows[2].textContent).toContain('PostMargin')
  })

  it('calls onRowClick with the event on row click', () => {
    const click = vi.fn()
    render(<LedgerEventTable events={events} onRowClick={click} />)
    const rows = screen.getAllByRole('row')
    fireEvent.click(rows[1])
    expect(click).toHaveBeenCalledWith(events[0])
  })

  it('shows an empty state when events is []', () => {
    render(<LedgerEventTable events={[]} onRowClick={vi.fn()} />)
    expect(screen.getByText(/No activity yet/i)).toBeTruthy()
  })
})
