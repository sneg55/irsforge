import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OversightPage } from '../oversight/page'

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

vi.mock('canton-party-directory/react', () => ({
  usePartyDirectory: () => ({ displayName: (id: string) => id, loading: false }),
}))

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: null, activeParty: 'Reg' }),
}))

vi.mock('@/shared/hooks/use-swap-instruments', () => ({
  useSwapInstruments: () => ({ byInstrumentId: new Map(), isLoading: false }),
}))

vi.mock('../hooks/use-all-swap-workflows', () => ({
  useAllSwapWorkflows: () => ({
    workflows: [
      {
        contractId: 'wf1',
        payload: {
          swapType: 'IRS',
          partyA: 'PartyA',
          partyB: 'PartyB',
          notional: '100000000.0',
          operator: 'Op',
          regulators: ['Reg'],
          scheduler: 'Sch',
          instrumentKey: {
            id: { unpack: 'I1' },
            version: '1',
            depository: 'D',
            issuer: 'I',
            holdingStandard: 'TF',
          },
        },
      },
    ],
    matured: [],
    terminated: [],
    isLoading: false,
  }),
}))

vi.mock('../hooks/use-all-proposals-cross-org', () => ({
  useAllProposalsCrossOrg: () => ({ proposals: [], isLoading: false }),
}))

describe('OversightPage', () => {
  it('renders the cross-org blotter with the seeded row', () => {
    render(<OversightPage />)
    expect(screen.queryByText('Oversight')).not.toBe(null)
    expect(screen.queryAllByText('PartyA').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('PartyB').length).toBeGreaterThan(0)
    expect(screen.queryByText('IRS')).not.toBe(null)
    expect(screen.queryByText('Live')).not.toBe(null)
  })

  it('renders no action buttons (anti-leak)', () => {
    render(<OversightPage />)
    const buttons = screen.queryAllByRole('button')
    const actionButtons = buttons.filter(
      (btn) => !btn.getAttribute('aria-label')?.startsWith('filter-'),
    )
    for (const btn of actionButtons) {
      const text = btn.textContent?.toLowerCase() ?? ''
      expect(/accept|reject|propose|terminate|trigger|new swap|withdraw/.test(text)).toBe(false)
    }
  })

  it('renders 1-of-1 trades count in header', () => {
    render(<OversightPage />)
    expect(screen.queryByText('1 of 1 trades')).not.toBe(null)
  })
})
