import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Blotter, workflowToRow } from '../page'

// --- Module mocks ---
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
  query: vi.fn(async (_tpl: string) => []),
}
vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: fakeClient, activeParty: 'PartyA', partyDisplayName: 'A' }),
}))

const draftsApi = {
  listDrafts: vi.fn(
    () => [] as Array<{ draftId: string; type: string; notional: number; lastModified: number }>,
  ),
  deleteDraft: vi.fn(),
  deleteAllDrafts: vi.fn(),
  saveDraft: vi.fn(),
  loadDraft: vi.fn(),
  generateDraftId: vi.fn(() => 'new-id'),
}
vi.mock('../../workspace/hooks/use-drafts', () => ({
  useDrafts: () => draftsApi,
}))

vi.mock('../hooks/use-all-proposals', () => ({
  useAllProposals: () => ({ proposalRows: [], isLoading: false }),
}))

vi.mock('../hooks/use-terminate-proposals', () => ({
  useTerminateProposals: () => new Map(),
}))

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

vi.mock('../hooks/use-blotter-valuation', () => ({
  useBlotterValuation: () => new Map(),
}))

vi.mock('@/shared/hooks/use-oracle-curve', () => ({
  useOracleCurve: () => ({ curve: null }),
}))

vi.mock('@/shared/ledger/useCurveStream', () => ({
  useCurveStream: () => ({ history: [], latest: null, status: 'idle' }),
}))

vi.mock('@/shared/ledger/useCurveBook', () => ({
  useCurveBook: () => ({ data: null }),
}))

vi.mock('@/shared/ledger/useFxSpots', () => ({
  useFxSpots: () => ({ data: {} }),
}))

vi.mock('@/shared/hooks/use-swap-instruments', () => ({
  useSwapInstruments: () => ({ byInstrumentId: new Map() }),
}))

const isOperatorMock = vi.fn(() => false)
const isRegulatorMock = vi.fn(() => false)
vi.mock('@/shared/hooks/use-is-operator', () => ({
  useIsOperator: () => isOperatorMock(),
  useIsRegulator: () => isRegulatorMock(),
  isOperatorParty: () => false,
  isRegulatorParty: () => false,
}))

vi.mock('../exposure-header', () => ({
  ExposureHeader: ({ data }: { data: { activeSwaps: number } }) => (
    <div data-testid="exposure-header" data-count={data.activeSwaps} />
  ),
  ExposureHeaderSkeleton: () => <div data-testid="exposure-skeleton" />,
}))

vi.mock('../row-details-drawer', () => ({
  RowDetailsDrawer: ({ row, onClose }: { row: unknown; onClose: () => void }) =>
    row ? (
      <div data-testid="row-drawer">
        <button onClick={onClose}>close-drawer</button>
      </div>
    ) : null,
}))

// Render the real SwapTable but stub its sparkline dep.
vi.mock('../../workspace/components/sparkline', () => ({
  Sparkline: () => <span data-testid="sparkline" />,
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
  isOperatorMock.mockReset()
  isOperatorMock.mockReturnValue(false)
  isRegulatorMock.mockReset()
  isRegulatorMock.mockReturnValue(false)
})
afterEach(() => cleanup())

describe('Blotter page', () => {
  test('hides New Swap button for operator account', () => {
    isOperatorMock.mockReturnValue(true)
    const { container } = render(<Blotter />, { wrapper })
    const btn = container.querySelector('[data-testid="new-swap-btn"]')
    expect(btn).toBeNull()
  })

  test('hides New Swap button for regulator account', () => {
    isRegulatorMock.mockReturnValue(true)
    const { container } = render(<Blotter />, { wrapper })
    const btn = container.querySelector('[data-testid="new-swap-btn"]')
    expect(btn).toBeNull()
  })

  test('renders heading and New Swap button; clicking New Swap navigates to workspace', () => {
    const { container, getByText } = render(<Blotter />, { wrapper })
    expect(container.textContent).toMatch(/Trade Blotter/)
    fireEvent.click(getByText('New Swap'))
    expect(pushMock).toHaveBeenCalledWith('/org/goldman/workspace')
  })

  test('defaults to active tab when ?tab= is absent', async () => {
    const { container } = render(<Blotter />, { wrapper })
    await waitFor(() => {
      const activeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        (b.textContent ?? '').startsWith('Active'),
      )
      expect(activeBtn?.className).toMatch(/border-blue|text-white|bg-/)
    })
  })

  test('respects ?tab=drafts in the URL and shows draft rows', async () => {
    searchParamsState.params = new URLSearchParams('tab=drafts')
    draftsApi.listDrafts.mockReturnValue([
      { draftId: 'd1', type: 'IRS', notional: 1_000_000, lastModified: Date.now() },
    ])
    const { container } = render(<Blotter />, { wrapper })
    await waitFor(() => {
      expect(container.textContent).toMatch(/Draft/)
    })
  })

  test('onDeleteDraft handler is wired — delete button on draft row calls deleteDraft', async () => {
    searchParamsState.params = new URLSearchParams('tab=drafts')
    draftsApi.listDrafts.mockReturnValue([
      { draftId: 'd1', type: 'IRS', notional: 1_000_000, lastModified: Date.now() },
    ])
    const { container } = render(<Blotter />, { wrapper })
    await waitFor(() => {
      const del = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Delete',
      )
      expect(del).toBeDefined()
    })
    const del = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete',
    )!
    fireEvent.click(del)
    expect(draftsApi.deleteDraft).toHaveBeenCalledWith('d1')
  })

  test('switching to proposals tab calls router.replace with ?tab=proposals', async () => {
    const { container } = render(<Blotter />, { wrapper })
    await waitFor(() => {
      const p = Array.from(container.querySelectorAll('button')).find((b) =>
        (b.textContent ?? '').startsWith('Proposals'),
      )
      expect(p).toBeDefined()
    })
    const proposalsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').startsWith('Proposals'),
    )!
    fireEvent.click(proposalsBtn)
    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('tab=proposals'), {
      scroll: false,
    })
  })

  test('shows exposure header once loaded', async () => {
    const { findByTestId } = render(<Blotter />, { wrapper })
    expect(await findByTestId('exposure-header')).toBeDefined()
  })
})

describe('workflowToRow', () => {
  test('marks status UnwindPending when a terminate proposal exists for the contract', () => {
    const proposals = new Map([
      [
        'c1',
        {
          proposer: 'PartyB::abc',
          proposalCid: 'tp-1',
          counterparty: 'PartyA::1',
          proposedPvAmount: 0,
        },
      ],
    ])
    const row = workflowToRow(
      {
        contractId: 'c1',
        payload: {
          partyA: 'PartyA::1',
          partyB: 'PartyB::2',
          swapType: 'IRS',
          notional: '1000000',
          instrumentKey: { id: { unpack: 'i-1' } },
        } as never,
      },
      'PartyA',
      undefined,
      undefined,
      proposals,
    )
    expect(row.status).toBe('UnwindPending')
    expect(row.pendingUnwind?.role).toBe('counterparty')
    expect(row.pendingUnwind?.proposalCid).toBe('tp-1')
    expect(row.counterparty).toBe('PartyB::2')
  })

  test('no proposal → status Active, counterparty is the other party', () => {
    const row = workflowToRow(
      {
        contractId: 'c2',
        payload: {
          partyA: 'PartyA::1',
          partyB: 'PartyB::2',
          swapType: 'CDS',
          notional: '500000',
          instrumentKey: { id: { unpack: 'i-2' } },
        } as never,
      },
      'PartyB',
      { npv: 42, dv01: 5, sparkline: [1, 2] },
      undefined,
      new Map(),
    )
    expect(row.status).toBe('Active')
    expect(row.counterparty).toBe('PartyA::1')
    expect(row.npv).toBe(42)
    expect(row.dv01).toBe(5)
  })
})
