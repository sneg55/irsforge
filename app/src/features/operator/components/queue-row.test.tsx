import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OperatorQueueItem } from '../hooks/use-operator-queue'

// Mocks must be declared before imports that use them
const mockRouterPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

const mockConfirmAccept = vi.fn()

vi.mock('../ledger/confirm-accept', () => ({
  confirmAccept: (...args: unknown[]) => mockConfirmAccept(...args),
}))

const mockClient = { exercise: vi.fn() }

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: mockClient }),
}))

import { QueueRow } from './queue-row'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const DISPUTE_ITEM: OperatorQueueItem = {
  type: 'dispute',
  id: 'dispute-csa-1',
  title: 'CSA PartyA–PartyB: dispute',
  subtitle: 'Mark disputed — operator adjudication required',
  deepLinkHref: '/org/demo/csa?pair=x',
  sortKey: 100,
}

const ACCEPT_ACK_ITEM: OperatorQueueItem = {
  type: 'accept-ack',
  id: 'accept-ack-irs-1',
  title: 'IRS proposal — BankA → BankB: awaiting co-sign',
  subtitle: 'IRS proposal — awaiting co-sign',
  deepLinkHref: '/org/demo/workspace?proposal=abc',
  sortKey: 50,
  contractId: 'irs-ack-cid-99',
  family: 'IRS',
}

const LIFECYCLE_ITEM: OperatorQueueItem = {
  type: 'lifecycle',
  id: 'lifecycle-1',
  title: 'IRS fixing due',
  subtitle: 'Scheduled fixing event',
  deepLinkHref: '/org/demo/workspace?swap=z',
  sortKey: 20,
}

describe('QueueRow', () => {
  it('dispute row: no Co-sign button visible', () => {
    const { container } = wrap(<QueueRow item={DISPUTE_ITEM} />)

    const buttons = container.querySelectorAll('button')
    const coSignBtn = Array.from(buttons).find((b) => b.textContent?.includes('Co-sign'))
    expect(coSignBtn).toBeUndefined()
  })

  it('lifecycle row: no Co-sign button visible', () => {
    const { container } = wrap(<QueueRow item={LIFECYCLE_ITEM} />)

    const buttons = container.querySelectorAll('button')
    const coSignBtn = Array.from(buttons).find((b) => b.textContent?.includes('Co-sign'))
    expect(coSignBtn).toBeUndefined()
  })

  it('accept-ack row: Co-sign button is visible', () => {
    const { container } = wrap(<QueueRow item={ACCEPT_ACK_ITEM} />)

    const buttons = container.querySelectorAll('button')
    const coSignBtn = Array.from(buttons).find((b) => b.textContent?.includes('Co-sign'))
    expect(coSignBtn).toBeDefined()
  })

  it('accept-ack row: Co-sign click opens preview, confirm fires confirmAccept', async () => {
    mockConfirmAccept.mockResolvedValue(undefined)

    const { container, baseElement } = wrap(<QueueRow item={ACCEPT_ACK_ITEM} />)

    const coSignBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Co-sign'),
    )
    expect(coSignBtn).toBeDefined()
    fireEvent.click(coSignBtn!)

    // Preview modal renders before any ledger call
    const dialog = baseElement.querySelector('[data-testid="co-sign-preview-dialog"]')
    expect(dialog).not.toBeNull()
    expect(mockConfirmAccept).not.toHaveBeenCalled()

    const confirmBtn = baseElement.querySelector(
      '[data-testid="co-sign-confirm"]',
    ) as HTMLButtonElement
    expect(confirmBtn).not.toBeNull()
    fireEvent.click(confirmBtn)

    await new Promise((r) => setTimeout(r, 0))

    expect(mockConfirmAccept).toHaveBeenCalledWith(mockClient, {
      family: 'IRS',
      ackContractId: 'irs-ack-cid-99',
    })
  })

  it('row click triggers router.push with deepLinkHref', () => {
    mockRouterPush.mockReset()
    const { container } = wrap(<QueueRow item={DISPUTE_ITEM} />)

    const row = container.querySelector('[role="row"]')
    expect(row).not.toBeNull()
    fireEvent.click(row!)

    expect(mockRouterPush).toHaveBeenCalledWith('/org/demo/csa?pair=x')
  })

  it('row displays title and subtitle text', () => {
    const { container } = wrap(<QueueRow item={ACCEPT_ACK_ITEM} />)

    expect(container.textContent).toContain('IRS proposal — BankA → BankB: awaiting co-sign')
    expect(container.textContent).toContain('IRS proposal — awaiting co-sign')
  })

  it('dispute row displays Dispute badge', () => {
    const { container } = wrap(<QueueRow item={DISPUTE_ITEM} />)
    expect(container.textContent).toContain('Dispute')
  })

  it('accept-ack row displays Co-sign badge', () => {
    const { container } = wrap(<QueueRow item={ACCEPT_ACK_ITEM} />)
    // Badge text appears once, button text appears separately
    const text = container.textContent ?? ''
    expect(text).toContain('Co-sign')
  })
})
