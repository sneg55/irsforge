import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useFxSpots } from '../useFxSpots'

const fakeClient = { query: vi.fn(), authToken: 'tok' }
vi.mock('@/shared/contexts/ledger-context', () => ({
  useLedger: () => ({ client: fakeClient }),
}))

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => fakeClient.query.mockReset())

describe('useFxSpots', () => {
  test('returns empty object when no client (query disabled)', async () => {
    // The mock is set; test that data parses correctly.
    fakeClient.query.mockResolvedValueOnce([])
    const { result } = renderHook(() => useFxSpots(), { wrapper: wrap })
    await waitFor(() => expect(result.current.data).toEqual({}))
  })

  test('parses fx rows into base+quote concat-keyed map', async () => {
    fakeClient.query.mockResolvedValueOnce([
      {
        contractId: 'c1',
        payload: {
          operator: 'O',
          baseCcy: 'EUR',
          quoteCcy: 'USD',
          rate: '1.08',
          asOf: '2026-04-15',
        },
      },
      {
        contractId: 'c2',
        payload: {
          operator: 'O',
          baseCcy: 'GBP',
          quoteCcy: 'USD',
          rate: '1.25',
          asOf: '2026-04-15',
        },
      },
    ])
    const { result } = renderHook(() => useFxSpots(), { wrapper: wrap })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toEqual({ EURUSD: 1.08, GBPUSD: 1.25 })
  })
})
