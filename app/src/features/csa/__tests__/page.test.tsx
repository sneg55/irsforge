import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { CsaViewModel } from '../decode'
import type { CsaProposalRow } from '../hooks/use-csa-proposals'
import type { UseCsasResult } from '../hooks/use-csas'

import { CsaPage } from '../page'

// --- Mocks ---
const replaceMock = vi.fn()
const searchParamsState: { params: URLSearchParams } = { params: new URLSearchParams() }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  usePathname: () => '/org/goldman/csa',
  useSearchParams: () => searchParamsState.params,
}))

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: null, activeParty: 'PartyA', partyDisplayName: 'A' }),
}))

const useCsasMock = vi.fn()
vi.mock('../hooks/use-csas', () => ({ useCsas: () => useCsasMock() }))

const useCsaProposalsMock = vi.fn()
vi.mock('../hooks/use-csa-proposals', () => ({
  useCsaProposals: () => useCsaProposalsMock(),
  CSA_PROPOSALS_QUERY_KEY: 'csa-proposals',
}))

vi.mock('@/features/operator/ledger/csa-proposal-actions', () => ({
  exerciseCsaProposalChoice: vi.fn(),
}))

vi.mock('../hooks/use-mark-stream', () => ({
  useMarkStream: () => ({ latest: { exposure: 123 }, history: [], status: 'idle' }),
}))

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

vi.mock('../components/csa-drawer', () => ({
  CsaDrawer: () => <div data-testid="csa-drawer" />,
}))

const useIsOperatorMock = vi.fn(() => false)
const useIsRegulatorMock = vi.fn(() => false)
vi.mock('@/shared/hooks/use-is-operator', () => ({
  useIsOperator: () => useIsOperatorMock(),
  useIsRegulator: () => useIsRegulatorMock(),
}))

// CsaPage now mounts the New-CSA-proposal dialog (moved off the operator
// landing). The dialog reads currencies + orgs from useConfig and renders
// PartyName labels — supply enough to keep the dialog from throwing when
// the CsaPage tests render it (the button is hidden for operator anyway).
vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => ({
    config: {
      currencies: [{ code: 'USD', label: 'US Dollar', isDefault: true }],
      orgs: [
        { id: 'goldman', displayName: 'Goldman Sachs', hint: 'PartyA', role: 'trader' },
        { id: 'jpmorgan', displayName: 'JPMorgan', hint: 'PartyB', role: 'trader' },
        { id: 'operator', displayName: 'Operator', hint: 'Operator', role: 'operator' },
        { id: 'regulator', displayName: 'Regulator', hint: 'Regulator', role: 'regulator' },
      ],
    },
    loading: false,
    getOrg: () => undefined,
  }),
}))

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function csa(overrides: Partial<CsaViewModel> = {}): CsaViewModel {
  return {
    contractId: 'cid-a',
    partyA: 'PartyA::1',
    partyB: 'PartyB::2',
    valuationCcy: 'USD',
    mta: 100000,
    rounding: 10000,
    postedByA: new Map([['USD', 0]]),
    postedByB: new Map([['USD', 0]]),
    state: 'Active',
    thresholdDirA: 0,
    thresholdDirB: 0,
    ...overrides,
  } as CsaViewModel
}

function csasResult(overrides: Partial<UseCsasResult> = {}): UseCsasResult {
  return {
    data: [],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }
}

function makeProposalRow(overrides: Partial<CsaProposalRow> = {}): CsaProposalRow {
  return {
    contractId: 'prop-1',
    proposerHint: 'PartyC',
    counterpartyHint: 'PartyA',
    thresholdDirA: 100000,
    thresholdDirB: 200000,
    mta: 50000,
    rounding: 1000,
    eligible: [],
    valuationCcy: 'USD',
    directionForMe: 'in',
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  useCsasMock.mockReset()
  useCsaProposalsMock.mockReset()
  useIsOperatorMock.mockReset()
  useIsOperatorMock.mockReturnValue(false)
  useIsRegulatorMock.mockReset()
  useIsRegulatorMock.mockReturnValue(false)
})

describe('CsaPage', () => {
  test('shows loading state', () => {
    useCsasMock.mockReturnValue(csasResult({ isLoading: true }))
    useCsaProposalsMock.mockReturnValue({ proposals: [], isLoading: false })
    const { container } = wrap(<CsaPage />)
    expect(container.querySelectorAll('tr[data-slot="csa-skeleton-row"]').length).toBeGreaterThan(0)
  })

  test('shows error state', () => {
    useCsasMock.mockReturnValue(csasResult({ error: new Error('boom') }))
    useCsaProposalsMock.mockReturnValue({ proposals: [], isLoading: false })
    const { container } = wrap(<CsaPage />)
    expect(container.textContent).toMatch(/boom/)
  })

  test('renders ErrorState with retry when useCsas errors', () => {
    const refetch = vi.fn()
    useCsasMock.mockReturnValue(csasResult({ error: new Error('boom'), refetch }))
    useCsaProposalsMock.mockReturnValue({ proposals: [], isLoading: false })
    const { getByText, getByRole } = wrap(<CsaPage />)
    expect(getByText('boom')).toBeTruthy()
    fireEvent.click(getByRole('button', { name: /retry/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  test('renders empty state when no csas', () => {
    useCsasMock.mockReturnValue(csasResult())
    useCsaProposalsMock.mockReturnValue({ proposals: [], isLoading: false })
    const { container, getByTestId } = wrap(<CsaPage />)
    expect(container.textContent).toMatch(/No CSAs/)
    expect(getByTestId('csa-tab-active').textContent).toMatch(/Active\s*\(0\)/)
  })

  test('renders table with one row and toggles drawer on click', () => {
    useCsasMock.mockReturnValue(csasResult({ data: [csa()] }))
    useCsaProposalsMock.mockReturnValue({ proposals: [], isLoading: false })
    const { container, queryByTestId, getByTestId } = wrap(<CsaPage />)
    expect(getByTestId('csa-tab-active').textContent).toMatch(/Active\s*\(1\)/)
    expect(queryByTestId('csa-drawer')).toBeNull()
    const row = container.querySelector('tbody tr') as HTMLElement
    fireEvent.click(row)
    expect(queryByTestId('csa-drawer')).not.toBeNull()
    fireEvent.click(row)
    expect(queryByTestId('csa-drawer')).toBeNull()
  })

  test('renders multiple rows with active tab count', () => {
    useCsasMock.mockReturnValue(
      csasResult({ data: [csa({ contractId: 'a' }), csa({ contractId: 'b' })] }),
    )
    useCsaProposalsMock.mockReturnValue({ proposals: [], isLoading: false })
    const { container, getByTestId } = wrap(<CsaPage />)
    expect(getByTestId('csa-tab-active').textContent).toMatch(/Active\s*\(2\)/)
    expect(container.querySelectorAll('tbody tr').length).toBe(2)
  })

  describe('Proposals tab', () => {
    test('Proposals tab count is 0 when no proposals', () => {
      useCsasMock.mockReturnValue(csasResult())
      useCsaProposalsMock.mockReturnValue({ proposals: [], isLoading: false })
      const { getByTestId } = wrap(<CsaPage />)
      expect(getByTestId('csa-tab-proposals').textContent).toMatch(/Proposals\s*\(0\)/)
    })

    test('Proposals tab shows in-direction Accept button when activated', () => {
      useCsasMock.mockReturnValue(csasResult())
      useCsaProposalsMock.mockReturnValue({
        proposals: [makeProposalRow({ directionForMe: 'in' })],
        isLoading: false,
      })
      const { container, getByTestId } = wrap(<CsaPage />)
      // Initially on the Active tab — proposal Accept button is not in the DOM yet.
      expect(
        Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Accept'),
      ).toBe(false)
      // Switch to the Proposals tab and the inbox row's Accept button shows up.
      fireEvent.click(getByTestId('csa-tab-proposals'))
      const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent)
      expect(buttons).toContain('Accept')
    })

    test('renders New CSA proposal button for traders', () => {
      // Moved off the operator landing so proposer = activeParty is always
      // a real trading party; otherwise the resulting Csa has partyA=Operator
      // which is structurally wrong.
      useIsOperatorMock.mockReturnValue(false)
      useCsasMock.mockReturnValue(csasResult())
      useCsaProposalsMock.mockReturnValue({ proposals: [], isLoading: false })
      const { container } = wrap(<CsaPage />)
      const buttons = Array.from(container.querySelectorAll('button'))
      const newProposalBtn = buttons.find((b) => b.textContent === 'New CSA proposal')
      expect(newProposalBtn).toBeDefined()
    })

    test('hides New CSA proposal button for operator', () => {
      // Operator is never a CSA party, so the create action is gated off.
      useIsOperatorMock.mockReturnValue(true)
      useCsasMock.mockReturnValue(csasResult())
      useCsaProposalsMock.mockReturnValue({ proposals: [], isLoading: false })
      const { container } = wrap(<CsaPage />)
      const buttons = Array.from(container.querySelectorAll('button'))
      const newProposalBtn = buttons.find((b) => b.textContent === 'New CSA proposal')
      expect(newProposalBtn).toBeUndefined()
    })

    test('hides New CSA proposal button for regulator', () => {
      // Regulator is a pure observer — no write-class actions.
      useIsRegulatorMock.mockReturnValue(true)
      useCsasMock.mockReturnValue(csasResult())
      useCsaProposalsMock.mockReturnValue({ proposals: [], isLoading: false })
      const { container } = wrap(<CsaPage />)
      const buttons = Array.from(container.querySelectorAll('button'))
      const newProposalBtn = buttons.find((b) => b.textContent === 'New CSA proposal')
      expect(newProposalBtn).toBeUndefined()
    })
  })
})
