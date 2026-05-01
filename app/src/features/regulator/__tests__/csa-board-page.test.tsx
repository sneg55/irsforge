import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CsaBoardPage } from '../csa-board/page'

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

vi.mock('../hooks/use-all-csas', () => ({
  useAllCsas: () => ({
    data: [
      {
        contractId: 'csa-active',
        operator: 'Op',
        partyA: 'PartyA',
        partyB: 'PartyB',
        regulators: ['Reg'],
        thresholdDirA: 0,
        thresholdDirB: 0,
        mta: 100000,
        rounding: 10000,
        valuationCcy: 'USD',
        postedByA: new Map([['USD', 1_000_000]]),
        postedByB: new Map(),
        state: 'Active',
        lastMarkCid: null,
        isdaMasterAgreementRef: '',
        governingLaw: 'NewYork',
        imAmount: 0,
      },
      {
        contractId: 'csa-disputed',
        operator: 'Op',
        partyA: 'PartyB',
        partyB: 'PartyC',
        regulators: ['Reg'],
        thresholdDirA: 0,
        thresholdDirB: 0,
        mta: 100000,
        rounding: 10000,
        valuationCcy: 'USD',
        postedByA: new Map(),
        postedByB: new Map([['USD', 500_000]]),
        state: 'MarkDisputed',
        lastMarkCid: 'mk1',
        isdaMasterAgreementRef: 'ISDA-2002-DEMO',
        governingLaw: 'English',
        imAmount: 25_000_000,
      },
    ],
    isLoading: false,
    error: null,
  }),
}))

describe('CsaBoardPage', () => {
  it('renders disputed CSA above the active CSA', () => {
    render(<CsaBoardPage />)
    const cards = document.querySelectorAll('[data-slot="csa-board-card"]')
    expect(cards.length).toBe(2)
    expect(cards[0].getAttribute('data-state')).toBe('MarkDisputed')
    expect(cards[1].getAttribute('data-state')).toBe('Active')
  })

  it('renders the count line', () => {
    render(<CsaBoardPage />)
    expect(screen.queryByText(/2 active CSAs/)).not.toBe(null)
  })

  it('renders ISDA MA / Governing law / Initial Margin rows on each card', () => {
    render(<CsaBoardPage />)
    const cards = document.querySelectorAll('[data-slot="csa-board-card"]')
    // Disputed card sorts first; assert its populated metadata renders.
    const disputed = cards[0] as HTMLElement
    const isda = disputed.querySelector('[data-testid="csa-board-isda-ma"]')
    const law = disputed.querySelector('[data-testid="csa-board-governing-law"]')
    const im = disputed.querySelector('[data-testid="csa-board-im-amount"]')
    expect(isda?.textContent).toContain('ISDA-2002-DEMO')
    expect(law?.textContent).toContain('English law')
    expect(im?.textContent).toContain('25,000,000 USD')
    // Active card has empty ref / NY law / zero IM ⇒ em-dashes.
    const active = cards[1] as HTMLElement
    expect(active.querySelector('[data-testid="csa-board-isda-ma"]')?.textContent).toContain('—')
    expect(active.querySelector('[data-testid="csa-board-governing-law"]')?.textContent).toContain(
      'NY law',
    )
    expect(active.querySelector('[data-testid="csa-board-im-amount"]')?.textContent).toContain('—')
  })
})
