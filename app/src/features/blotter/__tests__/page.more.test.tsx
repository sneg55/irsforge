import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Blotter } from '../page'

const pushMock = vi.fn()
const replaceMock = vi.fn()
const searchParamsState: { params: URLSearchParams } = { params: new URLSearchParams() }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => '/org/goldman/blotter',
  useSearchParams: () => searchParamsState.params,
}))

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

const fakeClient = {
  query: vi.fn<(tpl: string, filter?: Record<string, unknown>) => Promise<unknown[]>>(
    async () => [],
  ),
}
vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: fakeClient, activeParty: 'PartyA', partyDisplayName: 'A' }),
}))

const draftsApi = {
  listDrafts: vi.fn(() => []),
  deleteDraft: vi.fn(),
  deleteAllDrafts: vi.fn(),
  saveDraft: vi.fn(),
  loadDraft: vi.fn(),
  generateDraftId: vi.fn(() => 'new-id'),
}
vi.mock('../../workspace/hooks/use-drafts', () => ({ useDrafts: () => draftsApi }))

vi.mock('../hooks/use-all-proposals', () => ({
  useAllProposals: () => ({ proposalRows: [], isLoading: false }),
}))
vi.mock('../hooks/use-terminate-proposals', () => ({ useTerminateProposals: () => new Map() }))
vi.mock('@/features/csa/hooks/use-csa-summary', () => ({
  useCsaSummary: () => ({
    count: 0,
    configured: false,
    ownPosted: 0,
    cptyPosted: 0,
    exposure: null,
    state: 'Active',
    regulatorHints: [],
    phase: 'initial',
    isFetching: false,
  }),
}))
vi.mock('../hooks/use-blotter-valuation', () => ({ useBlotterValuation: () => new Map() }))
vi.mock('@/shared/hooks/use-oracle-curve', () => ({ useOracleCurve: () => ({ curve: null }) }))
vi.mock('@/shared/ledger/useCurveStream', () => ({
  useCurveStream: () => ({ history: [], latest: null, status: 'idle' }),
}))
vi.mock('@/shared/ledger/useCurveBook', () => ({ useCurveBook: () => ({ data: null }) }))
vi.mock('@/shared/ledger/useFxSpots', () => ({ useFxSpots: () => ({ data: {} }) }))
vi.mock('@/shared/hooks/use-swap-instruments', () => ({
  useSwapInstruments: () => ({ byInstrumentId: new Map() }),
}))

vi.mock('../exposure-header', () => ({
  ExposureHeader: ({ data }: { data: { activeSwaps: number } }) => (
    <div data-testid="exposure-header" data-count={data.activeSwaps} />
  ),
  ExposureHeaderSkeleton: () => <div data-testid="exposure-skeleton" />,
}))

// Stub table+drawer but capture their callbacks.
type OpenFn = (r: unknown) => void
const captured: {
  onOpenDetails?: OpenFn
  onDeleteAllDrafts?: () => void
  onTabChange?: (t: string) => void
} = {}
vi.mock('../swap-table', () => ({
  SwapTable: (p: {
    onOpenDetails: OpenFn
    onDeleteAllDrafts: () => void
    onTabChange: (t: string) => void
    rows: unknown[]
    activeTab: string
  }) => {
    captured.onOpenDetails = p.onOpenDetails
    captured.onDeleteAllDrafts = p.onDeleteAllDrafts
    captured.onTabChange = p.onTabChange
    return <div data-testid="swap-table" data-tab={p.activeTab} data-rows={p.rows.length} />
  },
}))
vi.mock('../row-details-drawer', () => ({
  RowDetailsDrawer: ({ row, onClose }: { row: unknown; onClose: () => void }) =>
    row ? (
      <div data-testid="row-drawer">
        <button onClick={onClose}>close</button>
      </div>
    ) : null,
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  pushMock.mockReset()
  replaceMock.mockReset()
  searchParamsState.params = new URLSearchParams()
  fakeClient.query.mockReset()
  fakeClient.query.mockResolvedValue([])
  draftsApi.listDrafts.mockReset()
  draftsApi.listDrafts.mockReturnValue([])
  draftsApi.deleteDraft.mockReset()
  draftsApi.deleteAllDrafts.mockReset()
})
afterEach(() => cleanup())

describe('Blotter page — extended', () => {
  test('opens row drawer via onOpenDetails and closes via RowDetailsDrawer onClose', async () => {
    const { queryByTestId, getByText, rerender } = render(<Blotter />, { wrapper })
    await waitFor(() => expect(queryByTestId('swap-table')).not.toBeNull())
    // Open drawer via captured callback
    captured.onOpenDetails!({
      contractId: 'r1',
      type: 'IRS',
      counterparty: 'B',
      notional: 1,
      currency: 'USD',
      maturity: '-',
      npv: null,
      dv01: null,
      status: 'Active',
      direction: 'pay',
    })
    rerender(<Blotter />)
    await waitFor(() => expect(queryByTestId('row-drawer')).not.toBeNull())
    fireEvent.click(getByText('close'))
    await waitFor(() => expect(queryByTestId('row-drawer')).toBeNull())
  })

  test('onDeleteAllDrafts forwards to drafts hook', async () => {
    const { queryByTestId } = render(<Blotter />, { wrapper })
    await waitFor(() => expect(queryByTestId('swap-table')).not.toBeNull())
    captured.onDeleteAllDrafts!()
    expect(draftsApi.deleteAllDrafts).toHaveBeenCalled()
  })

  test('switching from non-active tab back to active removes the ?tab= param', async () => {
    searchParamsState.params = new URLSearchParams('tab=drafts')
    const { queryByTestId } = render(<Blotter />, { wrapper })
    await waitFor(() => expect(queryByTestId('swap-table')).not.toBeNull())
    captured.onTabChange!('active')
    expect(replaceMock).toHaveBeenCalledWith('/org/goldman/blotter', { scroll: false })
  })

  test('ignores an unknown ?tab= value and falls back to active', async () => {
    searchParamsState.params = new URLSearchParams('tab=bogus')
    const { queryByTestId } = render(<Blotter />, { wrapper })
    await waitFor(() =>
      expect(queryByTestId('swap-table')?.getAttribute('data-tab')).toBe('active'),
    )
  })

  test('renders matured rows when tab=matured and contracts exist', async () => {
    searchParamsState.params = new URLSearchParams('tab=matured')
    fakeClient.query.mockImplementation(async (tpl: string) => {
      if (tpl === 'Swap.Workflow:MaturedSwap') {
        return [
          {
            contractId: 'm1',
            payload: {
              partyA: 'PartyA::1',
              partyB: 'PartyB::2',
              swapType: 'IRS',
              notional: '1000',
              instrumentKey: { id: { unpack: 'i-1' } },
              maturedAt: '2026-01-01T00:00:00Z',
            },
          },
        ]
      }
      return []
    })
    const { queryByTestId } = render(<Blotter />, { wrapper })
    await waitFor(() => {
      const t = queryByTestId('swap-table')
      expect(t?.getAttribute('data-rows')).toBe('1')
      expect(t?.getAttribute('data-tab')).toBe('matured')
    })
  })

  test('renders unwound rows when tab=unwound and terminated contracts exist', async () => {
    searchParamsState.params = new URLSearchParams('tab=unwound')
    fakeClient.query.mockImplementation(async (tpl: string) => {
      if (tpl === 'Swap.Terminate:TerminatedSwap') {
        return [
          {
            contractId: 't1',
            payload: {
              partyA: 'PartyA::1',
              partyB: 'PartyB::2',
              swapType: 'IRS',
              notional: '500',
              instrumentKey: { id: { unpack: 'i-9' } },
              terminatedAt: '2026-02-01T00:00:00Z',
            },
          },
        ]
      }
      return []
    })
    const { queryByTestId } = render(<Blotter />, { wrapper })
    await waitFor(() => {
      expect(queryByTestId('swap-table')?.getAttribute('data-tab')).toBe('unwound')
    })
  })
})
