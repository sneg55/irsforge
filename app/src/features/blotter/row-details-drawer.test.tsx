import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RowDetailsDrawer } from './row-details-drawer'
import type { SwapRow } from './types'

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

const maturedRow: SwapRow = {
  contractId: 'cid-m',
  type: 'IRS',
  counterparty: 'PartyB',
  notional: 10_000_000,
  currency: 'USD',
  maturity: '2026-04-01',
  npv: null,
  dv01: null,
  status: 'Matured',
  direction: 'pay',
  terminalDate: '2026-04-02',
  terminalAmount: 12345.67,
  settleBatchCid: 'batch-cid-1',
}

const unwoundRow: SwapRow = {
  contractId: 'cid-u',
  type: 'IRS',
  counterparty: 'PartyB',
  notional: 5_000_000,
  currency: 'USD',
  maturity: '2027-01-01',
  npv: null,
  dv01: null,
  status: 'Unwound',
  direction: 'pay',
  terminalDate: '2026-04-13',
  terminalAmount: -98765.43,
  reason: 'Counterparty unwind',
  terminatedByParty: 'PartyB',
  settleBatchCid: null,
}

describe('RowDetailsDrawer', () => {
  let onClose: () => void
  let onCloseMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onCloseMock = vi.fn()
    onClose = onCloseMock as unknown as () => void
  })

  it('renders nothing when row is null', () => {
    const { container } = render(<RowDetailsDrawer row={null} onClose={onClose} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders matured close-out fields', () => {
    render(<RowDetailsDrawer row={maturedRow} onClose={onClose} />)
    expect(screen.getByText(/Actual Maturity/i)).toBeTruthy()
    expect(screen.getByText('2026-04-02')).toBeTruthy()
    expect(screen.getByText(/Final Net/i)).toBeTruthy()
    expect(screen.getByText('batch-cid-1')).toBeTruthy()
    expect(screen.queryByText(/Reason/i)).toBeNull()
  })

  it('renders unwound close-out fields including reason and terminatedBy', () => {
    render(<RowDetailsDrawer row={unwoundRow} onClose={onClose} />)
    expect(screen.getByText(/Termination Date/i)).toBeTruthy()
    expect(screen.getByText('2026-04-13')).toBeTruthy()
    expect(screen.getByText(/Agreed PV/i)).toBeTruthy()
    expect(screen.getByText('Counterparty unwind')).toBeTruthy()
    expect(screen.getByText(/Terminated By/i)).toBeTruthy()
    expect(screen.getByText(/No cash settlement/i)).toBeTruthy()
  })

  it('closes on Escape key', () => {
    render(<RowDetailsDrawer row={maturedRow} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('closes on backdrop click', () => {
    render(<RowDetailsDrawer row={maturedRow} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('row-details-backdrop'))
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('copy-CID button writes the CID to clipboard', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<RowDetailsDrawer row={maturedRow} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    expect(writeText).toHaveBeenCalledWith('batch-cid-1')
  })
})
