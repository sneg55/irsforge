import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LedgerActivityProvider, useLedgerActivityContext } from '../ledger-activity-provider'

// Mock the stream hook + ledger context so the provider can mount in jsdom
// without a real WebSocket or JWT.
vi.mock('@/shared/hooks/use-streamed-events', () => ({
  useStreamedEvents: () => ({ status: 'idle', lastError: null }),
}))
vi.mock('@/shared/contexts/ledger-context', () => ({
  useLedger: () => ({ client: null, activeOrg: null, activeParty: null, partyDisplayName: '' }),
}))

function Probe() {
  const ctx = useLedgerActivityContext()
  return <div data-testid="count">{ctx.events.length}</div>
}

describe('LedgerActivityProvider', () => {
  it('exposes an empty event list when feature is disabled', () => {
    render(
      <LedgerActivityProvider
        enabled={false}
        bufferSize={100}
        templateFilter={{ allow: [], deny: [] }}
      >
        <Probe />
      </LedgerActivityProvider>,
    )
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('useLedgerActivityContext throws when used outside provider', () => {
    const ConsoleError = console.error
    console.error = () => {}
    expect(() => render(<Probe />)).toThrow()
    console.error = ConsoleError
  })
})
