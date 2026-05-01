import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCsas } from '../use-csas'

const mockQuery = vi.fn()
vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({
    client: { query: mockQuery, authToken: 'tok' },
    activeParty: 'PA',
    partyDisplayName: 'Party A',
  }),
}))

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => mockQuery.mockReset())

describe('useCsas', () => {
  it('queries CSA template and decodes the payload', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        contractId: 'cid1',
        payload: {
          operator: 'Op',
          partyA: 'PA',
          partyB: 'PB',
          regulators: ['Reg'],
          threshold: [
            ['DirA', '0.0'],
            ['DirB', '0.0'],
          ],
          mta: '100000.0',
          rounding: '10000.0',
          eligible: [{ currency: 'USD', haircut: '1.0' }],
          valuationCcy: 'USD',
          csb: [['USD', '5000000.0']],
          state: 'Active',
          lastMarkCid: null,
          activeDispute: null,
          isdaMasterAgreementRef: '',
          governingLaw: 'NewYork',
          imAmount: '0',
        },
      },
    ])
    const { result } = renderHook(() => useCsas(), { wrapper: wrap })
    await waitFor(() => expect(result.current.data.length).toBe(1))
    expect(result.current.data[0].partyA).toBe('PA')
    expect(result.current.data[0].postedByA.get('USD')).toBe(5_000_000)
  })

  it('returns empty array when client is null', async () => {
    const { result } = renderHook(() => useCsas(), { wrapper: wrap })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual([])
  })
})
