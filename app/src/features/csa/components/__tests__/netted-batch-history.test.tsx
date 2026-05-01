import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NettedBatchHistory } from '../netted-batch-history'

afterEach(() => cleanup())

const queryMock = vi.fn()
vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({
    client: { authToken: 't', query: queryMock },
    activeParty: 'PA',
    partyDisplayName: 'Party A',
  }),
}))

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const sampleBatch = (
  csaCid: string,
  paymentTimestamp: string,
  netByCcy: [string, string][],
  effectsCount = 1,
) => ({
  contractId: `nb-${paymentTimestamp}`,
  payload: {
    operator: 'Op',
    partyA: 'PA',
    partyB: 'PB',
    regulators: ['Reg'],
    scheduler: 'Sch',
    csaCid,
    paymentTimestamp,
    netByCcy,
    settledEffects: Array.from({ length: effectsCount }, (_, i) => `e${i}`),
    batchCid: null,
  },
})

describe('NettedBatchHistory', () => {
  it('renders empty state when no batches exist for this CSA', async () => {
    queryMock.mockResolvedValueOnce([])
    render(<NettedBatchHistory csaCid="csa-1" />, { wrapper: wrap })
    await waitFor(() => {
      expect(screen.getByText(/No net flows have settled yet/)).toBeTruthy()
    })
  })

  it('renders signed per-ccy nets color-coded green/red', async () => {
    queryMock.mockResolvedValueOnce([
      sampleBatch(
        'csa-1',
        '2026-04-18T10:00:00Z',
        [
          ['USD', '1000.00'],
          ['EUR', '-500.00'],
        ],
        3,
      ),
    ])
    render(<NettedBatchHistory csaCid="csa-1" />, { wrapper: wrap })
    await waitFor(() => {
      const usd = screen.getByText(/\+1,000 USD/)
      const eur = screen.getByText(/-500 EUR/)
      expect(usd.className).toMatch(/green/)
      expect(eur.className).toMatch(/rose/)
      expect(screen.getByText(/3 effects/)).toBeTruthy()
    })
  })

  it('filters by csaCid (ignores batches for other CSAs)', async () => {
    queryMock.mockResolvedValueOnce([
      sampleBatch('csa-1', '2026-04-18T10:00:00Z', [['USD', '100']]),
      sampleBatch('csa-2', '2026-04-18T11:00:00Z', [['USD', '999']]),
    ])
    render(<NettedBatchHistory csaCid="csa-1" />, { wrapper: wrap })
    await waitFor(() => {
      expect(screen.getByText(/\+100 USD/)).toBeTruthy()
      expect(screen.queryByText(/\+999 USD/)).toBeNull()
    })
  })

  it('orders batches in reverse chronological order (newest first)', async () => {
    queryMock.mockResolvedValueOnce([
      sampleBatch('csa-1', '2026-04-18T10:00:00Z', [['USD', '111']]),
      sampleBatch('csa-1', '2026-04-18T12:00:00Z', [['USD', '222']]),
      sampleBatch('csa-1', '2026-04-18T11:00:00Z', [['USD', '333']]),
    ])
    const { container } = render(<NettedBatchHistory csaCid="csa-1" />, { wrapper: wrap })
    await waitFor(() => {
      const ts = Array.from(container.querySelectorAll('div.text-xs.text-zinc-400')).map(
        (n) => n.textContent,
      )
      expect(ts).toEqual(['2026-04-18T12:00:00Z', '2026-04-18T11:00:00Z', '2026-04-18T10:00:00Z'])
    })
  })

  it('renders skeleton rows while query is pending', () => {
    queryMock.mockImplementationOnce(() => new Promise(() => {}))
    const { container } = render(<NettedBatchHistory csaCid="csa-1" />, { wrapper: wrap })
    const rows = container.querySelectorAll('[data-slot="netted-batch-skeleton-row"]')
    expect(rows.length).toBeGreaterThanOrEqual(3)
  })
})
