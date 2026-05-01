import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CsaBoardPage } from '../csa-board/page'
import { OversightPage } from '../oversight/page'
import { TimelinePage } from '../timeline/page'

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

vi.mock('canton-party-directory/react', () => ({
  usePartyDirectory: () => ({ displayName: (id: string) => id, loading: false }),
}))

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: null, activeParty: 'Reg' }),
}))

vi.mock('@/shared/hooks/use-swap-instruments', () => ({
  useSwapInstruments: () => ({ byInstrumentId: new Map(), isLoading: false }),
}))

vi.mock('@/shared/hooks/use-active-org-role', () => ({
  useActiveOrgRole: () => 'regulator',
}))

vi.mock('@/shared/hooks/use-is-operator', async () => {
  const actual = await vi.importActual<typeof import('@/shared/hooks/use-is-operator')>(
    '@/shared/hooks/use-is-operator',
  )
  return {
    ...actual,
    useIsOperator: () => false,
    useIsRegulator: () => true,
  }
})

vi.mock('@/features/regulator/hooks/use-all-swap-workflows', () => ({
  useAllSwapWorkflows: () => ({
    workflows: [
      {
        contractId: 'wf1',
        payload: {
          swapType: 'IRS',
          partyA: 'PartyA',
          partyB: 'PartyB',
          notional: '100000000.0',
          operator: 'Op',
          regulators: ['Reg'],
          scheduler: 'Sch',
          instrumentKey: {
            id: { unpack: 'I1' },
            version: '1',
            depository: 'D',
            issuer: 'I',
            holdingStandard: 'TF',
          },
        },
      },
    ],
    matured: [],
    terminated: [],
    isLoading: false,
  }),
}))

vi.mock('@/features/regulator/hooks/use-all-proposals-cross-org', () => ({
  useAllProposalsCrossOrg: () => ({ proposals: [], isLoading: false }),
}))

vi.mock('@/features/regulator/hooks/use-all-csas', () => ({
  useAllCsas: () => ({
    data: [
      {
        contractId: 'csa1',
        operator: 'Op',
        partyA: 'PartyA',
        partyB: 'PartyB',
        regulators: ['Reg'],
        thresholdDirA: 0,
        thresholdDirB: 0,
        mta: 0,
        rounding: 0,
        valuationCcy: 'USD',
        postedByA: new Map(),
        postedByB: new Map(),
        state: 'Active',
        lastMarkCid: null,
        isdaMasterAgreementRef: '',
        governingLaw: 'NewYork',
        imAmount: 0,
      },
    ],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/features/regulator/hooks/use-business-events', () => ({
  useBusinessEvents: () => ({ events: [], phase: 'streaming' }),
}))

const FORBIDDEN = /accept|reject|propose|terminate|trigger|new swap|withdraw|dispute/i

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function assertNoActionButtons() {
  const buttons = screen.queryAllByRole('button')
  // Exclude filter-pill buttons — they have aria-label="filter-..." and a status name
  // ('proposed', 'live', etc.) that would otherwise match the FORBIDDEN regex.
  const actionButtons = buttons.filter((b) => !b.getAttribute('aria-label')?.startsWith('filter-'))
  for (const b of actionButtons) {
    const label = b.textContent?.trim() ?? ''
    if (FORBIDDEN.test(label)) {
      throw new Error(`Anti-leak: regulator UI rendered forbidden button "${label}"`)
    }
  }
}

describe('regulator anti-leak — no write-class buttons reach the regulator', () => {
  it('OversightPage', () => {
    render(wrap(<OversightPage />))
    assertNoActionButtons()
  })

  it('TimelinePage', () => {
    render(wrap(<TimelinePage />))
    assertNoActionButtons()
  })

  it('CsaBoardPage', () => {
    render(wrap(<CsaBoardPage />))
    assertNoActionButtons()
  })
})
