import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockQuery = vi.fn()

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({
    client: { query: mockQuery },
    activeParty: 'PartyA',
  }),
}))

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const { useCsaProposals } = await import('../use-csa-proposals')

const PROPOSALS_RAW = [
  {
    contractId: 'cid-1',
    payload: {
      operator: 'Operator::fp0',
      regulators: ['Regulator::fp0'],
      proposer: 'PartyA::fp1',
      counterparty: 'PartyB::fp2',
      thresholdDirA: '100000',
      thresholdDirB: '200000',
      mta: '50000',
      rounding: '1000',
      eligible: [{ currency: 'USD', haircut: '0.02' }],
      valuationCcy: 'USD',
    },
  },
  {
    contractId: 'cid-2',
    payload: {
      operator: 'Operator::fp0',
      regulators: ['Regulator::fp0'],
      proposer: 'PartyC::fp3',
      counterparty: 'PartyA::fp4',
      thresholdDirA: '0',
      thresholdDirB: '0',
      mta: '0',
      rounding: '0',
      eligible: [],
      valuationCcy: 'EUR',
    },
  },
  {
    contractId: 'cid-3',
    payload: {
      operator: 'Operator::fp0',
      regulators: ['Regulator::fp0'],
      proposer: 'PartyC::fp3',
      counterparty: 'PartyD::fp5',
      thresholdDirA: '0',
      thresholdDirB: '0',
      mta: '0',
      rounding: '0',
      eligible: [],
      valuationCcy: 'GBP',
    },
  },
]

beforeEach(() => {
  mockQuery.mockReset()
  mockQuery.mockResolvedValue(PROPOSALS_RAW)
})

describe('useCsaProposals', () => {
  it('returns directionForMe=out when activeParty is proposer', async () => {
    const { result } = renderHook(() => useCsaProposals(), { wrapper: wrap })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const row = result.current.proposals.find((p) => p.contractId === 'cid-1')
    expect(row).toBeDefined()
    expect(row?.directionForMe).toBe('out')
  })

  it('returns directionForMe=in when activeParty is counterparty', async () => {
    const { result } = renderHook(() => useCsaProposals(), { wrapper: wrap })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const row = result.current.proposals.find((p) => p.contractId === 'cid-2')
    expect(row).toBeDefined()
    expect(row?.directionForMe).toBe('in')
  })

  it('returns directionForMe=observer when activeParty is neither', async () => {
    const { result } = renderHook(() => useCsaProposals(), { wrapper: wrap })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const row = result.current.proposals.find((p) => p.contractId === 'cid-3')
    expect(row).toBeDefined()
    expect(row?.directionForMe).toBe('observer')
  })

  it('returns correct row fields', async () => {
    const { result } = renderHook(() => useCsaProposals(), { wrapper: wrap })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const row = result.current.proposals.find((p) => p.contractId === 'cid-1')
    expect(row?.proposerHint).toBe('PartyA')
    expect(row?.counterpartyHint).toBe('PartyB')
    expect(row?.thresholdDirA).toBe(100000)
    expect(row?.thresholdDirB).toBe(200000)
    expect(row?.mta).toBe(50000)
    expect(row?.rounding).toBe(1000)
    expect(row?.valuationCcy).toBe('USD')
    expect(row?.eligible).toEqual([{ currency: 'USD', haircut: '0.02' }])
  })

  it('returns empty list when ledger returns no proposals', async () => {
    mockQuery.mockResolvedValue([])
    const { result } = renderHook(() => useCsaProposals(), { wrapper: wrap })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.proposals).toHaveLength(0)
  })
})
