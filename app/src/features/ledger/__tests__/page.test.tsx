import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LedgerActivityProvider } from '../contexts/ledger-activity-provider'
import LedgerPage from '../page'

vi.mock('next/navigation', () => ({
  useParams: () => ({ orgId: 'demo' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))

vi.mock('@/shared/hooks/use-streamed-events', () => ({
  useStreamedEvents: () => ({ status: 'open', lastError: null }),
}))

vi.mock('@/shared/contexts/ledger-context', () => ({
  useLedger: () => ({ client: null, activeOrg: null, activeParty: null, partyDisplayName: '' }),
}))

vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => ({
    config: {
      ledgerUi: { rawPayload: { enabled: true } },
    },
    loading: false,
    getOrg: () => undefined,
  }),
}))

function wrap(children: ReactNode) {
  return (
    <LedgerActivityProvider enabled={true} bufferSize={50} templateFilter={{ allow: [], deny: [] }}>
      {children}
    </LedgerActivityProvider>
  )
}

describe('LedgerPage', () => {
  it('shows the empty state when buffer is empty', () => {
    render(wrap(<LedgerPage />))
    expect(screen.getByText(/No activity yet/i)).toBeTruthy()
  })

  it('shows 0 events in the count chip', () => {
    render(wrap(<LedgerPage />))
    expect(screen.getByText(/0 events/i)).toBeTruthy()
  })

  it('shows the "live" indicator', () => {
    render(wrap(<LedgerPage />))
    expect(screen.getByText(/live/i)).toBeTruthy()
  })
})
