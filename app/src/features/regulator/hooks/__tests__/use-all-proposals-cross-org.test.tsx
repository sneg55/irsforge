import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAllProposalsCrossOrg } from '../use-all-proposals-cross-org'

const mockQuery = vi.fn()
vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({
    client: { query: mockQuery, authToken: 'tok' },
    activeParty: 'Regulator',
    partyDisplayName: 'Regulator',
  }),
}))

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => mockQuery.mockReset())

describe('useAllProposalsCrossOrg', () => {
  it('aggregates proposals across all swap families with their family tag', async () => {
    mockQuery.mockImplementation((templateId: string) => {
      if (templateId === 'Swap.Proposal:SwapProposal') {
        return [
          {
            contractId: 'p1',
            payload: {
              proposer: 'PartyA',
              counterparty: 'PartyB',
              operator: 'Operator',
              notional: '100000000.0',
              fixRate: '0.04',
              tenor: '5Y',
              startDate: '2026-01-01',
              dayCountConvention: 'Act360',
            },
          },
        ]
      }
      if (templateId === 'Swap.OisProposal:OisProposal') {
        return [
          {
            contractId: 'p2',
            payload: {
              proposer: 'PartyB',
              counterparty: 'PartyA',
              operator: 'Operator',
              notional: '50000000.0',
              fixRate: '0.03',
              startDate: '2026-01-01',
              maturityDate: '2027-01-01',
              dayCountConvention: 'Act360',
            },
          },
        ]
      }
      return []
    })

    const { result } = renderHook(() => useAllProposalsCrossOrg(), { wrapper: wrap })
    await waitFor(() => expect(result.current.proposals.length).toBe(2))
    const families = result.current.proposals.map((p) => p.family).sort()
    expect(families).toEqual(['IRS', 'OIS'])
  })

  it('returns empty array when client is null', async () => {
    vi.doMock('@/shared/hooks/use-ledger-client', () => ({
      useLedgerClient: () => ({ client: null, activeParty: null, partyDisplayName: '' }),
    }))
    const { useAllProposalsCrossOrg: useNull } = await import('../use-all-proposals-cross-org')
    const { result } = renderHook(() => useNull(), { wrapper: wrap })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.proposals).toEqual([])
  })
})
