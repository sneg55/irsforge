'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock useLedger to provide orgId via activeOrg
vi.mock('@/shared/contexts/ledger-context', () => ({
  useLedger: () => ({
    client: { query: mockQuery, authToken: 'tok' },
    activeParty: 'Operator',
    partyDisplayName: 'Operator',
    activeOrg: { id: 'demo-org' },
  }),
}))

// Mock useLedgerClient for sub-hooks that use it
vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({
    client: { query: mockQuery, authToken: 'tok' },
    activeParty: 'Operator',
    partyDisplayName: 'Operator',
  }),
}))

// Mock useCsas — 2 CSAs, one MarkDisputed and one Active
vi.mock('@/features/csa/hooks/use-csas', () => ({
  useCsas: () => ({
    data: [
      {
        contractId: 'csa-cid-1',
        operator: 'Operator',
        partyA: 'PartyA',
        partyB: 'PartyB',
        regulators: ['Reg'],
        thresholdDirA: 0,
        thresholdDirB: 0,
        mta: 100000,
        rounding: 10000,
        valuationCcy: 'USD',
        postedByA: new Map(),
        postedByB: new Map(),
        state: 'MarkDisputed',
        lastMarkCid: null,
        activeDispute: null,
        isdaMasterAgreementRef: '',
        governingLaw: 'NewYork',
        imAmount: 0,
      },
      {
        contractId: 'csa-cid-2',
        operator: 'Operator',
        partyA: 'PartyC',
        partyB: 'PartyD',
        regulators: ['Reg'],
        thresholdDirA: 0,
        thresholdDirB: 0,
        mta: 100000,
        rounding: 10000,
        valuationCcy: 'USD',
        postedByA: new Map(),
        postedByB: new Map(),
        state: 'Active',
        lastMarkCid: null,
        activeDispute: null,
        isdaMasterAgreementRef: '',
        governingLaw: 'NewYork',
        imAmount: 0,
      },
    ],
    isLoading: false,
    error: null,
  }),
}))

const mockQuery = vi.fn()

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// Import after mocks are set up
const { useOperatorQueue } = await import('../use-operator-queue')

beforeEach(() => {
  mockQuery.mockReset()
  // By default return empty accept-ack results for all template queries
  mockQuery.mockResolvedValue([])
})

describe('useOperatorQueue', () => {
  it('includes only MarkDisputed CSAs as dispute items, not Active ones', async () => {
    const { result } = renderHook(() => useOperatorQueue(), { wrapper: wrap })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const disputes = result.current.items.filter((i) => i.type === 'dispute')
    expect(disputes).toHaveLength(1)
    expect(disputes[0].id).toBe('dispute-csa-cid-1')
    expect(disputes[0].title).toContain('PartyA')
    expect(disputes[0].title).toContain('PartyB')
    expect(disputes[0].sortKey).toBe(100)
  })

  it('includes accept-ack items for IRS and CDS acks', async () => {
    mockQuery.mockImplementation((templateId: string) => {
      if (templateId.includes('Swap.Proposal:IrsAcceptAck')) {
        return Promise.resolve([
          {
            contractId: 'irs-ack-cid-1',
            payload: {
              operator: 'Operator',
              proposer: 'PartyA',
              counterparty: 'PartyB',
              proposalCid: 'irs-prop-cid-1',
            },
          },
        ])
      }
      if (templateId.includes('Swap.CdsProposal:CdsAcceptAck')) {
        return Promise.resolve([
          {
            contractId: 'cds-ack-cid-1',
            payload: {
              operator: 'Operator',
              proposer: 'PartyC',
              counterparty: 'PartyD',
              proposalCid: 'cds-prop-cid-1',
            },
          },
        ])
      }
      return Promise.resolve([])
    })

    const { result } = renderHook(() => useOperatorQueue(), { wrapper: wrap })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const acks = result.current.items.filter((i) => i.type === 'accept-ack')
    expect(acks).toHaveLength(2)

    const irsAck = acks.find((a) => a.id === 'accept-ack-irs-ack-cid-1')
    expect(irsAck).toBeDefined()
    expect(irsAck?.title).toContain('IRS')
    expect(irsAck?.sortKey).toBe(50)
    expect(irsAck?.contractId).toBe('irs-ack-cid-1')
    expect(irsAck?.family).toBe('IRS')

    const cdsAck = acks.find((a) => a.id === 'accept-ack-cds-ack-cid-1')
    expect(cdsAck).toBeDefined()
    expect(cdsAck?.title).toContain('CDS')
    expect(cdsAck?.sortKey).toBe(50)
    expect(cdsAck?.contractId).toBe('cds-ack-cid-1')
    expect(cdsAck?.family).toBe('CDS')
  })

  it('sorts disputes before accept-acks', async () => {
    mockQuery.mockImplementation((templateId: string) => {
      if (templateId.includes('Swap.Proposal:IrsAcceptAck')) {
        return Promise.resolve([
          {
            contractId: 'irs-ack-cid-2',
            payload: {
              operator: 'Operator',
              proposer: 'PartyA',
              counterparty: 'PartyB',
              proposalCid: 'irs-prop-cid-2',
            },
          },
        ])
      }
      return Promise.resolve([])
    })

    const { result } = renderHook(() => useOperatorQueue(), { wrapper: wrap })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const items = result.current.items
    const firstDisputeIdx = items.findIndex((i) => i.type === 'dispute')
    const firstAckIdx = items.findIndex((i) => i.type === 'accept-ack')

    expect(firstDisputeIdx).not.toBe(-1)
    expect(firstAckIdx).not.toBe(-1)
    expect(firstDisputeIdx).toBeLessThan(firstAckIdx)
  })

  it('has no duplicate ids', async () => {
    mockQuery.mockImplementation((templateId: string) => {
      if (templateId.includes('Swap.Proposal:IrsAcceptAck')) {
        return Promise.resolve([
          {
            contractId: 'irs-ack-dedup',
            payload: {
              operator: 'Operator',
              proposer: 'PartyA',
              counterparty: 'PartyB',
              proposalCid: 'irs-prop-dedup',
            },
          },
        ])
      }
      return Promise.resolve([])
    })

    const { result } = renderHook(() => useOperatorQueue(), { wrapper: wrap })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const ids = result.current.items.map((i) => i.id)
    const uniqueIds = new Set(ids)
    expect(ids.length).toBe(uniqueIds.size)
  })

  it('returns isLoading true while accept-ack queries are pending', async () => {
    // All accept-ack queries hang (never resolve) → isLoading stays true
    mockQuery.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useOperatorQueue(), { wrapper: wrap })
    // Queries not yet resolved — isLoading should be true
    expect(result.current.isLoading).toBe(true)
  })

  it('returns empty lifecycle items (Task 10 stub)', async () => {
    const { result } = renderHook(() => useOperatorQueue(), { wrapper: wrap })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const lifecycle = result.current.items.filter((i) => i.type === 'lifecycle')
    expect(lifecycle).toHaveLength(0)
  })
})
