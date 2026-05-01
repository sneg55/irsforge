import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CsaProposalRow } from '../../hooks/use-csa-proposals'

const mockExercise = vi.fn()

vi.mock('@/features/operator/ledger/csa-proposal-actions', () => ({
  exerciseCsaProposalChoice: (...args: unknown[]) => mockExercise(...args),
}))

const mockClient = {}

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({
    client: mockClient,
    activeParty: 'PartyA',
  }),
}))

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

import { CsaProposalsTable } from '../csa-proposals-table'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function makeRow(overrides: Partial<CsaProposalRow>): CsaProposalRow {
  return {
    contractId: 'cid-1',
    proposerHint: 'PartyA',
    counterpartyHint: 'PartyB',
    thresholdDirA: 100000,
    thresholdDirB: 200000,
    mta: 50000,
    rounding: 1000,
    eligible: [],
    valuationCcy: 'USD',
    directionForMe: 'in',
    ...overrides,
  }
}

describe('CsaProposalsTable', () => {
  it('renders nothing when rows array is empty', () => {
    const { container } = wrap(<CsaProposalsTable rows={[]} />)
    expect(container.querySelector('table')).toBeNull()
  })

  it('renders a table when rows are present', () => {
    const { container } = wrap(<CsaProposalsTable rows={[makeRow({})]} />)
    expect(container.querySelector('table')).not.toBeNull()
  })

  it('in-direction: renders Accept and Reject buttons, not Withdraw', () => {
    const row = makeRow({ contractId: 'cid-in', directionForMe: 'in' })
    const { container } = wrap(<CsaProposalsTable rows={[row]} />)
    const tr = container.querySelector('[data-testid="proposal-row-cid-in"]')
    expect(tr).not.toBeNull()
    const buttons = Array.from(tr!.querySelectorAll('button')).map((b) => b.textContent)
    expect(buttons).toContain('Accept')
    expect(buttons).toContain('Reject')
    expect(buttons).not.toContain('Withdraw')
  })

  it('in-direction: clicking Accept calls handler with contractId', async () => {
    mockExercise.mockResolvedValue(undefined)
    const row = makeRow({ contractId: 'cid-in', directionForMe: 'in' })
    const { container } = wrap(<CsaProposalsTable rows={[row]} />)
    const tr = container.querySelector('[data-testid="proposal-row-cid-in"]')!
    const acceptBtn = Array.from(tr.querySelectorAll('button')).find(
      (b) => b.textContent === 'Accept',
    )!
    fireEvent.click(acceptBtn)
    await new Promise((r) => setTimeout(r, 0))
    expect(mockExercise).toHaveBeenCalledWith(mockClient, 'cid-in', 'accept')
  })

  it('in-direction: clicking Reject calls handler with contractId', async () => {
    mockExercise.mockResolvedValue(undefined)
    const row = makeRow({ contractId: 'cid-in', directionForMe: 'in' })
    const { container } = wrap(<CsaProposalsTable rows={[row]} />)
    const tr = container.querySelector('[data-testid="proposal-row-cid-in"]')!
    const rejectBtn = Array.from(tr.querySelectorAll('button')).find(
      (b) => b.textContent === 'Reject',
    )!
    fireEvent.click(rejectBtn)
    await new Promise((r) => setTimeout(r, 0))
    expect(mockExercise).toHaveBeenCalledWith(mockClient, 'cid-in', 'reject')
  })

  it('out-direction: renders Withdraw button, not Accept/Reject', () => {
    const row = makeRow({ contractId: 'cid-out', directionForMe: 'out' })
    const { container } = wrap(<CsaProposalsTable rows={[row]} />)
    const tr = container.querySelector('[data-testid="proposal-row-cid-out"]')
    expect(tr).not.toBeNull()
    const buttons = Array.from(tr!.querySelectorAll('button')).map((b) => b.textContent)
    expect(buttons).toContain('Withdraw')
    expect(buttons).not.toContain('Accept')
    expect(buttons).not.toContain('Reject')
  })

  it('out-direction: clicking Withdraw calls handler with contractId', async () => {
    mockExercise.mockResolvedValue(undefined)
    const row = makeRow({ contractId: 'cid-out', directionForMe: 'out' })
    const { container } = wrap(<CsaProposalsTable rows={[row]} />)
    const tr = container.querySelector('[data-testid="proposal-row-cid-out"]')!
    const withdrawBtn = Array.from(tr.querySelectorAll('button')).find(
      (b) => b.textContent === 'Withdraw',
    )!
    fireEvent.click(withdrawBtn)
    await new Promise((r) => setTimeout(r, 0))
    expect(mockExercise).toHaveBeenCalledWith(mockClient, 'cid-out', 'withdraw')
  })

  it('observer-direction: renders no action buttons', () => {
    const row = makeRow({ contractId: 'cid-obs', directionForMe: 'observer' })
    const { container } = wrap(<CsaProposalsTable rows={[row]} />)
    const tr = container.querySelector('[data-testid="proposal-row-cid-obs"]')
    expect(tr).not.toBeNull()
    expect(tr!.querySelectorAll('button')).toHaveLength(0)
  })
})
