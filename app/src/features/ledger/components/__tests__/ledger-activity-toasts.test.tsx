import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ledgerActivityBus } from '@/shared/ledger/activity-bus'
import { LedgerActivityProvider } from '../../contexts/ledger-activity-provider'
import { LedgerActivityToasts } from '../ledger-activity-toasts'

vi.mock('next/navigation', () => ({
  useParams: () => ({ orgId: 'demo' }),
}))
vi.mock('@/shared/hooks/use-streamed-events', () => ({
  useStreamedEvents: () => ({ status: 'idle', lastError: null }),
}))
vi.mock('@/shared/contexts/ledger-context', () => ({
  useLedger: () => ({ client: null, activeOrg: null, activeParty: null, partyDisplayName: '' }),
}))
vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

function wrap(children: ReactNode, opts?: { systemPrefixes?: readonly string[] }) {
  return (
    <LedgerActivityProvider
      enabled={true}
      bufferSize={50}
      templateFilter={{
        allow: [],
        deny: [],
        systemPrefixes: opts?.systemPrefixes,
      }}
    >
      {children}
    </LedgerActivityProvider>
  )
}

// Toast component suppresses the first 1.5s of events after mount to swallow
// Canton's /v1/stream/query initial ACS replay. Tests that expect toasts must
// advance past this window between render and emit.
const PAST_GRACE_MS = 1600

describe('LedgerActivityToasts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a toast when an exercise event lands', () => {
    render(
      wrap(
        <LedgerActivityToasts
          maxVisible={3}
          dismissAfterMs={5000}
          denyPrefixes={[]}
          orgId="demo"
        />,
      ),
    )
    act(() => {
      vi.advanceTimersByTime(PAST_GRACE_MS)
    })
    act(() => {
      ledgerActivityBus.emit({
        templateId: 'IRSForge:Csa.Csa:Csa',
        contractId: '00abc',
        choice: 'PostMargin',
        actAs: ['Alice'],
        ts: Date.now(),
      })
    })
    expect(screen.getByText('PostMargin')).toBeTruthy()
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })

  it('caps visible toasts at maxVisible', () => {
    render(
      wrap(
        <LedgerActivityToasts
          maxVisible={2}
          dismissAfterMs={10_000}
          denyPrefixes={[]}
          orgId="demo"
        />,
      ),
    )
    act(() => {
      vi.advanceTimersByTime(PAST_GRACE_MS)
    })
    act(() => {
      for (let i = 0; i < 5; i++) {
        ledgerActivityBus.emit({
          templateId: 'T',
          contractId: String(i),
          choice: 'C',
          actAs: [],
          ts: Date.now() + i,
        })
      }
    })
    expect(screen.getAllByRole('status').length).toBeLessThanOrEqual(2)
  })

  it('auto-dismisses after dismissAfterMs', () => {
    render(
      wrap(
        <LedgerActivityToasts
          maxVisible={3}
          dismissAfterMs={1000}
          denyPrefixes={[]}
          orgId="demo"
        />,
      ),
    )
    act(() => {
      vi.advanceTimersByTime(PAST_GRACE_MS)
    })
    act(() => {
      ledgerActivityBus.emit({
        templateId: 'T',
        contractId: 'c',
        choice: 'X',
        actAs: [],
        ts: Date.now(),
      })
    })
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.queryAllByRole('status').length).toBe(0)
  })

  it('surfaces EXERCISE events even when their template is in systemPrefixes', () => {
    // Exercise events only come from the browser's own LedgerClient.exercise
    // calls — always user-triggered. They must bypass the systemPrefixes
    // filter so that e.g. a user PostCollateral on a Csa.Csa cid still pops
    // even though `Csa.Csa` is in the system-chatter list.
    render(
      wrap(
        <LedgerActivityToasts
          maxVisible={3}
          dismissAfterMs={5000}
          denyPrefixes={[]}
          orgId="demo"
        />,
        { systemPrefixes: ['Csa.Csa'] },
      ),
    )
    act(() => {
      vi.advanceTimersByTime(PAST_GRACE_MS)
    })
    act(() => {
      ledgerActivityBus.emit({
        templateId: 'pkgHex:Csa.Csa:Csa',
        contractId: '00abc',
        choice: 'PostCollateral',
        actAs: ['Alice'],
        ts: Date.now(),
      })
    })
    expect(screen.getByText('PostCollateral')).toBeTruthy()
    expect(screen.getAllByRole('status').length).toBe(1)
  })

  it('suppresses toasts during the initial-ACS grace window', () => {
    render(
      wrap(
        <LedgerActivityToasts
          maxVisible={3}
          dismissAfterMs={5000}
          denyPrefixes={[]}
          orgId="demo"
        />,
      ),
    )
    // Emit inside the grace window — should NOT produce a toast.
    act(() => {
      ledgerActivityBus.emit({
        templateId: 'T',
        contractId: 'initial',
        choice: 'X',
        actAs: [],
        ts: Date.now(),
      })
    })
    expect(screen.queryAllByRole('status').length).toBe(0)
  })

  it('applies denyPrefixes — denied templates never show', () => {
    render(
      wrap(
        <LedgerActivityToasts
          maxVisible={3}
          dismissAfterMs={5000}
          denyPrefixes={['Daml.Finance.Holding']}
          orgId="demo"
        />,
      ),
    )
    act(() => {
      ledgerActivityBus.emit({
        templateId:
          '5dbb311231f77fedf2892491802ac925448d3e48b5e610d46a1950dbc0e4ae8f:Daml.Finance.Holding.V4.TransferableFungible:TransferableFungible',
        contractId: 'c',
        choice: 'X',
        actAs: [],
        ts: Date.now(),
      })
    })
    expect(screen.queryAllByRole('status').length).toBe(0)
  })
})
