import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTerminateProposals } from './use-terminate-proposals'

const mockClient = { query: vi.fn() }

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: mockClient, activeParty: 'PartyA' }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useTerminateProposals', () => {
  beforeEach(() => {
    mockClient.query.mockReset()
  })

  it('returns a Map keyed by workflowCid', async () => {
    mockClient.query.mockResolvedValueOnce([
      {
        contractId: 'prop-1',
        payload: {
          proposer: 'PartyA::fp',
          counterparty: 'PartyB::fp',
          workflowCid: 'wf-1',
          proposedPvAmount: '1234.56',
          reason: 'r',
          proposedAt: '2026-04-21T00:00:00Z',
        },
      },
      {
        contractId: 'prop-2',
        payload: {
          proposer: 'PartyB::fp',
          counterparty: 'PartyA::fp',
          workflowCid: 'wf-2',
          proposedPvAmount: '-500',
          reason: '',
          proposedAt: '2026-04-21T00:00:00Z',
        },
      },
    ])

    const { result } = renderHook(() => useTerminateProposals(), { wrapper })

    await waitFor(() => expect(result.current.size).toBe(2))

    expect(result.current.get('wf-1')).toEqual({
      proposalCid: 'prop-1',
      proposer: 'PartyA::fp',
      counterparty: 'PartyB::fp',
      proposedPvAmount: 1234.56,
    })
    expect(result.current.get('wf-2')?.proposalCid).toBe('prop-2')
  })

  it('returns an empty Map when query returns empty', async () => {
    mockClient.query.mockResolvedValueOnce([])
    const { result } = renderHook(() => useTerminateProposals(), { wrapper })
    await waitFor(() => expect(result.current).toBeInstanceOf(Map))
    expect(result.current.size).toBe(0)
  })
})
