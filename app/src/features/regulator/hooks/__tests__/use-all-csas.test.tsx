import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAllCsas } from '../use-all-csas'

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

describe('useAllCsas', () => {
  it('queries the CSA template and decodes every contract returned', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        contractId: 'csa1',
        payload: {
          operator: 'Operator',
          partyA: 'PartyA',
          partyB: 'PartyB',
          regulators: ['Regulator'],
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
          isdaMasterAgreementRef: '',
          governingLaw: 'NewYork',
          imAmount: '0',
        },
      },
      {
        contractId: 'csa2',
        payload: {
          operator: 'Operator',
          partyA: 'PartyB',
          partyB: 'PartyC',
          regulators: ['Regulator'],
          threshold: [
            ['DirA', '0.0'],
            ['DirB', '0.0'],
          ],
          mta: '100000.0',
          rounding: '10000.0',
          eligible: [{ currency: 'USD', haircut: '1.0' }],
          valuationCcy: 'USD',
          csb: [['USD', '-2000000.0']],
          state: 'MarkDisputed',
          lastMarkCid: 'mark99',
          isdaMasterAgreementRef: '',
          governingLaw: 'NewYork',
          imAmount: '0',
        },
      },
    ])
    const { result } = renderHook(() => useAllCsas(), { wrapper: wrap })
    await waitFor(() => expect(result.current.data.length).toBe(2))
    const states = result.current.data.map((c) => c.state).sort()
    expect(states).toEqual(['Active', 'MarkDisputed'])
  })
})
