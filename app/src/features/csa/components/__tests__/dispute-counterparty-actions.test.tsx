import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { DisputeCounterpartyActions } from '../dispute-counterparty-actions'

const fakeClient = { token: 'stub' }
vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: fakeClient, activeParty: 'PartyB' }),
}))

const escalateFn = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {})
const agreeFn = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {})
vi.mock('../../ledger/csa-actions', () => ({
  escalateDispute: (...args: unknown[]) => escalateFn(...args),
  agreeToCounterMark: (...args: unknown[]) => agreeFn(...args),
  makeCsaPairResolver: () => async () => 'resolved-cid',
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  escalateFn.mockClear()
  agreeFn.mockClear()
})
afterEach(() => cleanup())

const baseProps = {
  csaCid: 'csa-1',
  pairPartyA: 'PartyA',
  pairPartyB: 'PartyB',
  party: 'PartyB',
  disputer: 'PartyA',
  counterMark: 1234.56,
  reason: 'Valuation' as const,
  notes: 'mark looks high',
  ccy: 'USD',
  state: 'MarkDisputed' as const,
}

describe('DisputeCounterpartyActions', () => {
  test('renders Agree + Escalate buttons when state=MarkDisputed and party is non-disputer', () => {
    const { container } = render(<DisputeCounterpartyActions {...baseProps} />, { wrapper })
    expect(container.querySelector('[data-testid="dispute-counterparty-agree"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="dispute-counterparty-escalate"]')).not.toBeNull()
    expect(
      container.querySelector('[data-testid="dispute-counterparty-escalated-pill"]'),
    ).toBeNull()
  })

  test('renders nothing when active party is the disputer', () => {
    const { container } = render(<DisputeCounterpartyActions {...baseProps} party="PartyA" />, {
      wrapper,
    })
    expect(container.querySelector('[data-testid="dispute-counterparty-agree"]')).toBeNull()
    expect(container.querySelector('[data-testid="dispute-counterparty-escalate"]')).toBeNull()
  })

  test('renders read-only Escalated pill when state=Escalated', () => {
    const { container } = render(<DisputeCounterpartyActions {...baseProps} state="Escalated" />, {
      wrapper,
    })
    const pill = container.querySelector('[data-testid="dispute-counterparty-escalated-pill"]')
    expect(pill).not.toBeNull()
    expect(pill?.textContent).toContain('Escalated')
    expect(container.querySelector('[data-testid="dispute-counterparty-agree"]')).toBeNull()
    expect(container.querySelector('[data-testid="dispute-counterparty-escalate"]')).toBeNull()
  })

  test('clicking Escalate calls escalateDispute with active party', async () => {
    const { container } = render(<DisputeCounterpartyActions {...baseProps} />, { wrapper })
    const btn = container.querySelector(
      '[data-testid="dispute-counterparty-escalate"]',
    ) as HTMLButtonElement
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(escalateFn).toHaveBeenCalled()
    const call = escalateFn.mock.calls[0]
    // (client, csaCid, escalator, resolver)
    expect(call[1]).toBe('csa-1')
    expect(call[2]).toBe('PartyB')
  })

  test('Agree button opens confirm modal; confirm calls agreeToCounterMark', async () => {
    const { container } = render(<DisputeCounterpartyActions {...baseProps} />, { wrapper })
    const agreeBtn = container.querySelector(
      '[data-testid="dispute-counterparty-agree"]',
    ) as HTMLButtonElement
    fireEvent.click(agreeBtn)
    const confirm = container.querySelector(
      '[data-testid="dispute-counterparty-agree-confirm"]',
    ) as HTMLButtonElement
    expect(confirm).not.toBeNull()
    await act(async () => {
      fireEvent.click(confirm)
    })
    expect(agreeFn).toHaveBeenCalled()
    const call = agreeFn.mock.calls[0]
    // (client, csaCid, agreer, asOf, snapshot, resolver)
    expect(call[1]).toBe('csa-1')
    expect(call[2]).toBe('PartyB')
    expect(call[4]).toBe('{}')
  })

  test('renders nothing when state is Active', () => {
    const { container } = render(<DisputeCounterpartyActions {...baseProps} state="Active" />, {
      wrapper,
    })
    expect(container.firstChild).toBeNull()
  })
})
