import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PayloadSummary } from '../payload-summary'

vi.mock('next/navigation', () => ({
  useParams: () => ({ orgId: 'demo' }),
}))

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

describe('PayloadSummary', () => {
  it('renders CSA fields with labels and a state pill', () => {
    render(
      <PayloadSummary
        templateId="pkg:Csa.Csa:Csa"
        payload={{
          state: 'MarginCallOutstanding',
          partyA: 'Alice::ns',
          partyB: 'Bob::ns',
          valuationCcy: 'USD',
          mta: '250000',
          rounding: '10000',
          imAmount: '0',
          threshold: [
            ['DirA', '500000'],
            ['DirB', '500000'],
          ],
          csb: [['USD', '-125000']],
          governingLaw: 'NewYork',
          isdaMasterAgreementRef: 'ISDA-2002',
          lastMarkCid: '',
          activeDispute: '',
        }}
      />,
    )
    expect(screen.getByText('Credit support annex')).toBeTruthy()
    expect(screen.getByText('MarginCallOutstanding')).toBeTruthy()
    // MTA formatted as money with currency suffix
    expect(screen.getByText('250,000.00')).toBeTruthy()
    expect(screen.getByText('NewYork')).toBeTruthy()
  })

  it('renders a shortfall summary with deficit + currency', () => {
    render(
      <PayloadSummary
        templateId="pkg:Csa.Shortfall:MarginShortfall"
        payload={{
          debtor: 'Alice::ns',
          creditor: 'Bob::ns',
          deficit: '7500',
          currency: 'EUR',
          asOf: '2026-05-16T10:00:00Z',
          relatedMark: '',
          csaCid: '',
        }}
      />,
    )
    expect(screen.getByText('Margin shortfall')).toBeTruthy()
    expect(screen.getByText('7,500.00')).toBeTruthy()
    expect(screen.getByText('EUR')).toBeTruthy()
  })

  it('falls back to a heuristic key/value grid for unknown templates', () => {
    render(
      <PayloadSummary
        templateId="pkg:Foo.Bar:UnknownThing"
        payload={{
          someField: 'plain text',
          aParty: 'Alice::ns',
          amount: '1234.5',
        }}
      />,
    )
    expect(screen.getByText('Payload')).toBeTruthy()
    expect(screen.getByText('Some Field')).toBeTruthy()
    expect(screen.getByText('plain text')).toBeTruthy()
    // partyish string was routed through PartyName chip
    expect(screen.getByText('Alice::ns')).toBeTruthy()
    // decimal-looking string was rendered as a number
    expect(screen.getByText('1,234.5')).toBeTruthy()
  })

  it('renders nothing for null/non-object payloads', () => {
    const { container } = render(<PayloadSummary templateId="pkg:Foo.Bar:X" payload={null} />)
    expect(container.firstChild).toBeNull()
  })
})
