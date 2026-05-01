import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAllProposals } from '../use-all-proposals'

const mockClient = { query: vi.fn() }
vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: mockClient, activeParty: 'PartyA' }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// IRS-shaped proposal payload — getNotional/getCurrency etc. are type-dispatched
// off the TEMPLATES table, so only the fields the IRS branch reads are needed.
function irsProposal(cid: string, notional = '10000000') {
  return {
    contractId: cid,
    payload: {
      proposer: 'PartyA::fp',
      counterparty: 'PartyB::fp',
      notional,
      currency: 'USD',
      fixRate: '0.045',
      startDate: '2026-04-21',
      maturityDate: '2027-04-21',
      tenor: 'Y1',
      direction: 'PayFixed',
    },
  }
}

describe('useAllProposals', () => {
  beforeEach(() => {
    mockClient.query.mockReset()
  })

  it('aggregates rows across all proposal templates', async () => {
    mockClient.query.mockImplementation(async (tpl: string) => {
      if (tpl === 'Swap.Proposal:SwapProposal') return [irsProposal('irs-1')]
      if (tpl === 'Swap.OisProposal:OisProposal') return [irsProposal('ois-1')]
      return []
    })

    const { result } = renderHook(() => useAllProposals(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await waitFor(() => expect(result.current.proposalRows.length).toBe(2))

    const cids = result.current.proposalRows.map((r) => r.contractId).sort()
    expect(cids).toEqual(['irs-1', 'ois-1'])
    for (const row of result.current.proposalRows) {
      expect(row.status).toBe('Proposed')
      expect(row.notional).toBe(10_000_000)
    }
  })

  it('returns empty list when no proposals exist on any template', async () => {
    mockClient.query.mockResolvedValue([])
    const { result } = renderHook(() => useAllProposals(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.proposalRows).toEqual([])
  })

  it('tags row type with the template family', async () => {
    mockClient.query.mockImplementation(async (tpl: string) => {
      if (tpl === 'Swap.Proposal:SwapProposal') return [irsProposal('x-1')]
      return []
    })
    const { result } = renderHook(() => useAllProposals(), { wrapper })
    await waitFor(() => expect(result.current.proposalRows.length).toBe(1))
    expect(result.current.proposalRows[0].type).toBe('IRS')
  })
})
