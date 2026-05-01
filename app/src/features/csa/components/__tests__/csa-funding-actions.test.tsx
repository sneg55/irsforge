import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { CsaFundingActions } from '../csa-funding-actions'

// Mock ledger actions so we don't need a real Canton client.
const postCollateral = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {})
const withdrawExcess = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {})
const makeCsaPairResolver = vi.fn<(...args: unknown[]) => () => Promise<string>>(
  () => async () => 'resolved-cid',
)
vi.mock('../../ledger/csa-actions', () => ({
  postCollateral: (...args: unknown[]) => postCollateral(...args),
  withdrawExcess: (...args: unknown[]) => withdrawExcess(...args),
  makeCsaPairResolver: (...args: unknown[]) => makeCsaPairResolver(...args),
}))

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: { token: 'stub' }, activeParty: 'PartyA' }),
}))

// Dispute modal is heavy; stub it out — we only care about the action row here.
vi.mock('../csa-dispute-modal', () => ({
  CsaDisputeModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="dispute-open" /> : null,
}))

afterEach(() => {
  cleanup()
  postCollateral.mockClear()
  withdrawExcess.mockClear()
})

function renderWithQuery(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const baseProps = {
  csaCid: 'cid-1',
  pairPartyA: 'PartyA',
  pairPartyB: 'PartyB',
  ccy: 'USD',
  postedByMe: 100_000,
  party: 'PartyA',
  currentExposure: 50_000,
  state: 'Active' as const,
}

describe('CsaFundingActions', () => {
  test('renders three action buttons: Post, Withdraw, Dispute', () => {
    const { container } = renderWithQuery(<CsaFundingActions {...baseProps} />)
    const labels = Array.from(container.querySelectorAll('button')).map((b) => b.textContent)
    expect(labels).toContain('Post')
    expect(labels).toContain('Withdraw')
    expect(labels).toContain('Dispute')
  })

  test('Withdraw is disabled when postedByMe = 0', () => {
    const { container } = renderWithQuery(<CsaFundingActions {...baseProps} postedByMe={0} />)
    const withdraw = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Withdraw',
    ) as HTMLButtonElement
    expect(withdraw.disabled).toBe(true)
  })

  test('Dispute is disabled when already MarkDisputed', () => {
    const { container } = renderWithQuery(<CsaFundingActions {...baseProps} state="MarkDisputed" />)
    const dispute = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Dispute',
    ) as HTMLButtonElement
    expect(dispute.disabled).toBe(true)
  })

  test('Dispute is enabled in MarginCallOutstanding (parties can contest the mark that caused the call)', () => {
    const { container } = renderWithQuery(
      <CsaFundingActions {...baseProps} state="MarginCallOutstanding" />,
    )
    const dispute = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Dispute',
    ) as HTMLButtonElement
    expect(dispute.disabled).toBe(false)
  })

  test('clicking Post opens the amount modal', () => {
    const { container } = renderWithQuery(<CsaFundingActions {...baseProps} />)
    fireEvent.click(
      Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Post')!,
    )
    expect(container.textContent).toContain('POST COLLATERAL')
  })

  test('clicking Withdraw opens the withdraw-mode modal', () => {
    const { container } = renderWithQuery(<CsaFundingActions {...baseProps} />)
    fireEvent.click(
      Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Withdraw')!,
    )
    expect(container.textContent).toContain('WITHDRAW COLLATERAL')
  })

  test('submitting Post modal calls postCollateral with amount', async () => {
    const { container } = renderWithQuery(<CsaFundingActions {...baseProps} />)
    fireEvent.click(
      Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Post')!,
    )
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '250000' } })
    const submitBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Post' && b.closest('.fixed'),
    )!
    await act(async () => {
      fireEvent.click(submitBtn)
    })
    expect(postCollateral).toHaveBeenCalled()
    const call = postCollateral.mock.calls[0]
    // (client, csaCid, party, ccy, n, resolver)
    expect(call[1]).toBe('cid-1')
    expect(call[2]).toBe('PartyA')
    expect(call[3]).toBe('USD')
    expect(call[4]).toBe(250_000)
  })

  test('clicking Dispute opens dispute modal', () => {
    const { container } = renderWithQuery(<CsaFundingActions {...baseProps} />)
    fireEvent.click(
      Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Dispute')!,
    )
    expect(container.querySelector('[data-testid="dispute-open"]')).not.toBeNull()
  })
})
