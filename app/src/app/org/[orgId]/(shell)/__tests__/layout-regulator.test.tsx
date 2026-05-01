import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ShellLayout from '../layout'

const mockReplace = vi.fn()
const mockUsePathname = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ orgId: 'regulator' }),
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ replace: mockReplace }),
}))

vi.mock('next/link', () => ({
  default: (p: { children: React.ReactNode; href: string }) => <a href={p.href}>{p.children}</a>,
}))

vi.mock('@/shared/contexts/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isInitialized: true,
    state: { orgId: 'regulator', party: 'Regulator', userId: 'reg' },
  }),
}))

const ORGS = [
  { id: 'goldman', party: 'PartyA::a', hint: 'PartyA', role: 'trader', displayName: 'Goldman' },
  {
    id: 'operator',
    party: 'Operator::a',
    hint: 'Operator',
    role: 'operator',
    displayName: 'Operator',
  },
  {
    id: 'regulator',
    party: 'Regulator::a',
    hint: 'Regulator',
    role: 'regulator',
    displayName: 'Regulator',
  },
]
vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => ({
    config: {
      profile: 'demo',
      orgs: ORGS,
      ledgerUi: {
        enabled: false,
        bufferSize: 500,
        templateFilter: { allow: [], deny: [], systemPrefixes: [] },
        toasts: { enabled: false, maxVisible: 0, dismissAfterMs: 5000 },
        rawPayload: { enabled: false },
      },
    },
    loading: false,
    getOrg: (id: string) => ORGS.find((o) => o.id === id),
  }),
}))

vi.mock('@/shared/contexts/ledger-context', () => ({
  LedgerProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useLedger: () => ({
    activeParty: 'Regulator',
    partyDisplayName: 'Regulator',
    activeOrg: null,
    client: null,
  }),
}))

vi.mock('@/features/ledger/contexts/ledger-activity-provider', () => ({
  LedgerActivityProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/features/ledger/components/ledger-activity-toasts', () => ({
  LedgerActivityToasts: () => null,
}))
vi.mock('@/shared/layout/auth-header', () => ({
  AuthHeader: () => <div data-testid="auth-header" />,
}))
vi.mock('@/shared/layout/status-bar', () => ({ StatusBar: () => null }))
vi.mock('@/shared/layout/footer-slot-context', () => ({
  FooterSlotProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

beforeEach(() => {
  mockReplace.mockReset()
  mockUsePathname.mockReturnValue('/org/regulator/oversight')
})
afterEach(() => vi.clearAllMocks())

function renderShell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ShellLayout>
        <div>child</div>
      </ShellLayout>
    </QueryClientProvider>,
  )
}

describe('ShellLayout — regulator role', () => {
  it('renders Oversight | Timeline | CSA Board nav (no Blotter, no Workspace)', () => {
    renderShell()
    expect(screen.queryByText('Oversight')).not.toBe(null)
    expect(screen.queryByText('Timeline')).not.toBe(null)
    expect(screen.queryByText('CSA Board')).not.toBe(null)
    expect(screen.queryByText('Blotter')).toBe(null)
    expect(screen.queryByText('Workspace')).toBe(null)
    expect(screen.queryByText('CSAs')).toBe(null)
  })

  it('redirects /org/regulator/blotter to /org/regulator/oversight', () => {
    mockUsePathname.mockReturnValue('/org/regulator/blotter')
    renderShell()
    expect(mockReplace).toHaveBeenCalledWith('/org/regulator/oversight')
  })

  it('redirects /org/regulator/workspace to /org/regulator/oversight', () => {
    mockUsePathname.mockReturnValue('/org/regulator/workspace')
    renderShell()
    expect(mockReplace).toHaveBeenCalledWith('/org/regulator/oversight')
  })

  it('does not redirect when on a regulator-allowed path', () => {
    mockUsePathname.mockReturnValue('/org/regulator/timeline')
    renderShell()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
