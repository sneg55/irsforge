import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import ShellLayout from '../layout'

const replaceMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useParams: () => ({ orgId: 'goldman' }),
  usePathname: () => '/org/goldman/blotter',
}))
vi.mock('next/link', () => ({
  default: (p: { children: React.ReactNode; href: string }) => <a href={p.href}>{p.children}</a>,
}))

const auth = {
  isAuthenticated: false,
  isInitialized: false,
  state: null as null | { orgId: string },
}
vi.mock('@/shared/contexts/auth-context', () => ({ useAuth: () => auth }))

const ledger = {
  activeParty: null as string | null,
}
vi.mock('@/shared/contexts/ledger-context', () => ({
  LedgerProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useLedger: () => ({ ...ledger, client: null, partyDisplayName: '', activeOrg: null }),
}))
// Config carries the orgs list that `useActiveOrgRole` reads to resolve
// hint → role. PartyA = trader, Operator = operator, Regulator = regulator —
// covers every persona the layout's sidebar branches on.
const ORGS = [
  { id: 'goldman', party: 'PartyA::a', hint: 'PartyA', role: 'trader', displayName: 'Goldman' },
  { id: 'jpmorgan', party: 'PartyB::a', hint: 'PartyB', role: 'trader', displayName: 'JPM' },
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
    config: { profile: 'demo', orgs: ORGS },
    loading: false,
    getOrg: (id: string) => ORGS.find((o) => o.id === id),
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
vi.mock('@/shared/layout/status-bar', () => ({ StatusBar: () => <div data-testid="status-bar" /> }))
vi.mock('@/shared/layout/sandbox-rotation-handler', () => ({
  SandboxRotationHandler: () => null,
}))
vi.mock('@/shared/layout/footer-slot-context', () => ({
  FooterSlotProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

beforeEach(() => {
  replaceMock.mockReset()
  auth.isAuthenticated = false
  auth.isInitialized = false
  auth.state = null
  ledger.activeParty = null
})
afterEach(() => cleanup())

function renderAuthed(party: string | null = null) {
  auth.isAuthenticated = true
  auth.isInitialized = true
  auth.state = { orgId: 'goldman' }
  ledger.activeParty = party
  return render(
    <ShellLayout>
      <p>hello</p>
    </ShellLayout>,
  )
}

describe('ShellLayout', () => {
  test('shows loading indicator before init and does not redirect', () => {
    const { container, getByTestId } = render(<ShellLayout>child</ShellLayout>)
    expect(getByTestId('shell-init-loading')).toBeDefined()
    expect(container.textContent).not.toContain('child')
    expect(replaceMock).not.toHaveBeenCalled()
  })

  test('not authed after init → redirects to login', () => {
    auth.isInitialized = true
    render(<ShellLayout>child</ShellLayout>)
    expect(replaceMock).toHaveBeenCalledWith('/org/goldman/login')
  })

  test('authed for wrong orgId → redirects to login', () => {
    auth.isInitialized = true
    auth.isAuthenticated = true
    auth.state = { orgId: 'other' }
    render(<ShellLayout>child</ShellLayout>)
    expect(replaceMock).toHaveBeenCalledWith('/org/goldman/login')
  })

  test('authed for matching orgId → renders content with sidebar+header', () => {
    auth.isInitialized = true
    auth.isAuthenticated = true
    auth.state = { orgId: 'goldman' }
    const { getByTestId, container } = render(
      <ShellLayout>
        <p>hello</p>
      </ShellLayout>,
    )
    expect(getByTestId('auth-header')).toBeDefined()
    expect(getByTestId('status-bar')).toBeDefined()
    expect(container.textContent).toContain('hello')
    expect(container.textContent).toContain('Blotter')
  })

  test('renders trader nav items when activeParty is PartyA', () => {
    const { container } = renderAuthed('PartyA')
    expect(container.querySelector('a[href="/org/goldman/blotter"]')).not.toBeNull()
    expect(container.querySelector('a[href="/org/goldman/workspace"]')).not.toBeNull()
    expect(container.querySelector('a[href="/org/goldman/csa"]')).not.toBeNull()
    expect(container.querySelector('a[href="/org/goldman/operator"]')).toBeNull()
  })

  test('renders operator nav items when activeParty is Operator', () => {
    const { container } = renderAuthed('Operator')
    const operatorLink = container.querySelector('a[href="/org/goldman/operator"]')
    expect(operatorLink).not.toBeNull()
    // Operator link should appear before Blotter link
    const allLinks = Array.from(container.querySelectorAll('nav a'))
    const operatorIdx = allLinks.findIndex(
      (a) => a.getAttribute('href') === '/org/goldman/operator',
    )
    const blotterIdx = allLinks.findIndex((a) => a.getAttribute('href') === '/org/goldman/blotter')
    expect(operatorIdx).toBeGreaterThanOrEqual(0)
    expect(blotterIdx).toBeGreaterThan(operatorIdx)
  })

  test('strict match: lowercase "operator" does NOT get Operator nav', () => {
    // The substring .includes('operator') helper was replaced with strict
    // equality against PARTIES.OPERATOR.hint — catches impersonation by a
    // party whose hint happens to contain the substring.
    const { container } = renderAuthed('operator')
    expect(container.querySelector('a[href="/org/goldman/operator"]')).toBeNull()
  })
})
