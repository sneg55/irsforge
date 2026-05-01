import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CsaFundingActions } from '../../components/csa-funding-actions'

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({
    client: null,
    activeParty: 'PA',
    partyDisplayName: 'PA',
  }),
}))

function withQuery(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('CsaFundingActions when state is MarkDisputed', () => {
  it('disables the Dispute button (no double-dispute)', () => {
    const { getByText } = render(
      withQuery(
        <CsaFundingActions
          csaCid="c1"
          pairPartyA="PA"
          pairPartyB="PB"
          ccy="USD"
          postedByMe={1_000_000}
          party="PA"
          currentExposure={500_000}
          state="MarkDisputed"
        />,
      ),
    )
    const btn = getByText('Dispute') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('enables the Dispute button when state is Active', () => {
    const { getByText } = render(
      withQuery(
        <CsaFundingActions
          csaCid="c1"
          pairPartyA="PA"
          pairPartyB="PB"
          ccy="USD"
          postedByMe={1_000_000}
          party="PA"
          currentExposure={500_000}
          state="Active"
        />,
      ),
    )
    const btn = getByText('Dispute') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })
})
