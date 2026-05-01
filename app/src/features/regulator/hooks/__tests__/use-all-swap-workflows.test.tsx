import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAllSwapWorkflows } from '../use-all-swap-workflows'

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

describe('useAllSwapWorkflows', () => {
  it('returns active + matured + terminated rows from cross-org query', async () => {
    mockQuery
      .mockResolvedValueOnce([
        {
          contractId: 'wf1',
          payload: {
            swapType: 'IRS',
            operator: 'Operator',
            partyA: 'PartyA',
            partyB: 'PartyB',
            regulators: ['Regulator'],
            scheduler: 'Scheduler',
            instrumentKey: {
              id: { unpack: 'INSTR-1' },
              version: '1',
              depository: 'D',
              issuer: 'I',
              holdingStandard: 'TF',
            },
            notional: '100000000.0',
          },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const { result } = renderHook(() => useAllSwapWorkflows(), { wrapper: wrap })
    await waitFor(() => expect(result.current.workflows.length).toBe(1))
    expect(result.current.workflows[0].contractId).toBe('wf1')
    expect(result.current.matured).toEqual([])
    expect(result.current.terminated).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('aggregates workflows from three separate queries', async () => {
    const wf = { contractId: 'wf-1', payload: { id: '1' } }
    const mat = { contractId: 'mat-1', payload: { id: '2' } }
    const term = { contractId: 'term-1', payload: { id: '3' } }

    mockQuery.mockResolvedValueOnce([wf]).mockResolvedValueOnce([mat]).mockResolvedValueOnce([term])

    const { result } = renderHook(() => useAllSwapWorkflows(), { wrapper: wrap })
    await waitFor(() => expect(result.current.workflows.length).toBe(1))
    expect(result.current.matured.length).toBe(1)
    expect(result.current.terminated.length).toBe(1)
    expect(result.current.isLoading).toBe(false)
  })
})
