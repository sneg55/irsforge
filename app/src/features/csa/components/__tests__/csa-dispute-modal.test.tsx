import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { CsaDisputeModal } from '../csa-dispute-modal'

const fakeClient = { query: vi.fn() }
vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: fakeClient, activeParty: 'PA', partyDisplayName: 'A' }),
}))

const disputeFn = vi.fn()
vi.mock('../../ledger/csa-actions', () => ({
  dispute: (...args: unknown[]) => disputeFn(...args),
  makeCsaPairResolver: () => async () => 'cid-resolved',
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  disputeFn.mockReset()
})
afterEach(() => cleanup())

describe('CsaDisputeModal', () => {
  test('isOpen=false renders nothing', () => {
    const { container } = render(
      <CsaDisputeModal
        isOpen={false}
        onClose={() => {}}
        csaCid="c1"
        pairPartyA="A"
        pairPartyB="B"
        party="A"
        currentExposure={100}
      />,
      { wrapper },
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  test('submit with valid inputs calls dispute then onClose', async () => {
    disputeFn.mockResolvedValueOnce(undefined)
    const onClose = vi.fn()
    const { container, getByText } = render(
      <CsaDisputeModal
        isOpen
        onClose={onClose}
        csaCid="c1"
        pairPartyA="A"
        pairPartyB="B"
        party="A"
        currentExposure={1000}
      />,
      { wrapper },
    )
    const input = container.querySelector('#dispute-counter-mark') as HTMLInputElement
    expect(input.value).toBe('900.00')
    fireEvent.click(getByText('Dispute'))
    await waitFor(() => expect(disputeFn).toHaveBeenCalled())
    // default reason is 'Valuation', notes empty
    const lastCall = disputeFn.mock.calls[disputeFn.mock.calls.length - 1]
    expect(lastCall[2]).toBe('A') // party
    expect(lastCall[3]).toBe(900) // counterMark
    expect(lastCall[4]).toBe('Valuation') // reason
    expect(lastCall[5]).toBe('') // notes
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  test('invalid counter-mark triggers error and does not call dispute', async () => {
    const onClose = vi.fn()
    const { container, getByText } = render(
      <CsaDisputeModal
        isOpen
        onClose={onClose}
        csaCid="c1"
        pairPartyA="A"
        pairPartyB="B"
        party="A"
        currentExposure={null}
      />,
      { wrapper },
    )
    const input = container.querySelector('#dispute-counter-mark') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'not-a-number' } })
    fireEvent.click(getByText('Dispute'))
    await waitFor(() => expect(container.textContent).toContain('must be a number'))
    expect(disputeFn).not.toHaveBeenCalled()
  })

  test('reason dropdown renders all six DisputeReason values', () => {
    const { container } = render(
      <CsaDisputeModal
        isOpen
        onClose={() => {}}
        csaCid="c1"
        pairPartyA="A"
        pairPartyB="B"
        party="A"
        currentExposure={100}
      />,
      { wrapper },
    )
    const select = container.querySelector('#dispute-reason') as HTMLSelectElement
    expect(select).not.toBeNull()
    const options = Array.from(select.options).map((o) => o.value)
    expect(options).toEqual([
      'Valuation',
      'Collateral',
      'FxRate',
      'Threshold',
      'IndependentAmount',
      'Other',
    ])
    expect(select.value).toBe('Valuation')
  })

  test('submit with Collateral reason and notes calls dispute with correct args', async () => {
    disputeFn.mockResolvedValueOnce(undefined)
    const onClose = vi.fn()
    const { container, getByText } = render(
      <CsaDisputeModal
        isOpen
        onClose={onClose}
        csaCid="c1"
        pairPartyA="A"
        pairPartyB="B"
        party="A"
        currentExposure={1000}
      />,
      { wrapper },
    )
    const select = container.querySelector('#dispute-reason') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'Collateral' } })
    const notes = container.querySelector('#dispute-notes') as HTMLTextAreaElement
    fireEvent.change(notes, { target: { value: 'GBP not eligible' } })
    fireEvent.click(getByText('Dispute'))
    await waitFor(() => expect(disputeFn).toHaveBeenCalled())
    const lastCall = disputeFn.mock.calls[disputeFn.mock.calls.length - 1]
    // (client, csaCid, party, counterMark, reason, notes, resolver)
    expect(lastCall[1]).toBe('c1')
    expect(lastCall[2]).toBe('A')
    expect(lastCall[3]).toBe(900)
    expect(lastCall[4]).toBe('Collateral')
    expect(lastCall[5]).toBe('GBP not eligible')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  test('dispute throws → error message displayed, onClose not called', async () => {
    disputeFn.mockRejectedValueOnce(new Error('ledger fail'))
    const onClose = vi.fn()
    const { container, getByText } = render(
      <CsaDisputeModal
        isOpen
        onClose={onClose}
        csaCid="c1"
        pairPartyA="A"
        pairPartyB="B"
        party="A"
        currentExposure={100}
      />,
      { wrapper },
    )
    fireEvent.click(getByText('Dispute'))
    await waitFor(() => expect(container.textContent).toContain('ledger fail'))
    expect(onClose).not.toHaveBeenCalled()
  })

  test('Cancel button calls onClose', () => {
    const onClose = vi.fn()
    const { getByText } = render(
      <CsaDisputeModal
        isOpen
        onClose={onClose}
        csaCid="c1"
        pairPartyA="A"
        pairPartyB="B"
        party="A"
        currentExposure={100}
      />,
      { wrapper },
    )
    fireEvent.click(getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})
