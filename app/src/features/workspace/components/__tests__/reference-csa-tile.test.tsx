import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ReferenceCsaTile } from '../reference-csa-tile'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/org/goldman/workspace',
}))

// PartyName is the directory-aware renderer; stub it so tests can assert
// that the CSA tile delegates rendering rather than echoing the raw hint.
vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => (
    <span data-testid="party-name">{`<${identifier}>`}</span>
  ),
}))

afterEach(() => {
  cleanup()
  pushMock.mockReset()
})

describe('ReferenceCsaTile', () => {
  test('No-CSA placeholder when summary.count=0; click disabled', () => {
    const { container } = render(
      <ReferenceCsaTile
        cpty=""
        summary={{
          count: 0,
          configured: false,
          ownPosted: 0,
          cptyPosted: 0,
          exposure: null,
          state: 'Active',
          regulatorHints: [],
          phase: 'initial',
          isFetching: false,
          isdaMasterAgreementRef: '',
          governingLaw: 'NewYork',
          imAmount: 0,
          valuationCcy: '',
        }}
      />,
    )
    expect(container.textContent).toContain('No CSA')
    expect(container.querySelector('[data-testid="no-csa-tile"]')).not.toBeNull()
    fireEvent.click(container.firstChild as HTMLElement)
    expect(pushMock).not.toHaveBeenCalled()
  })

  test('configured — click pushes to org-scoped /csa', () => {
    const { container } = render(
      <ReferenceCsaTile
        cpty="Citi"
        summary={{
          count: 1,
          configured: true,
          ownPosted: 46,
          cptyPosted: 0,
          exposure: 50,
          state: 'Active',
          regulatorHints: [],
          phase: 'live',
          isFetching: false,
          isdaMasterAgreementRef: '',
          governingLaw: 'NewYork',
          imAmount: 0,
          valuationCcy: 'USD',
        }}
      />,
    )
    fireEvent.click(container.firstChild as HTMLElement)
    expect(pushMock).toHaveBeenCalledWith('/org/goldman/csa')
  })

  test('shows ISDA MA ref + governing law when populated, IM amount when > 0', () => {
    const { container } = render(
      <ReferenceCsaTile
        cpty="Citi"
        summary={{
          count: 1,
          configured: true,
          ownPosted: 0,
          cptyPosted: 0,
          exposure: 0,
          state: 'Active',
          regulatorHints: [],
          phase: 'live',
          isFetching: false,
          isdaMasterAgreementRef: 'ISDA-2002-DEMO',
          governingLaw: 'English',
          imAmount: 25_000_000,
          valuationCcy: 'USD',
        }}
      />,
    )
    const isdaRow = container.querySelector('[data-testid="csa-tile-isda-row"]')
    expect(isdaRow?.textContent).toContain('ISDA-2002-DEMO')
    expect(isdaRow?.textContent).toContain('English law')
    const imRow = container.querySelector('[data-testid="csa-tile-im-row"]')
    expect(imRow?.textContent).toContain('25,000,000 USD')
  })

  test('shows em-dash when ISDA MA ref empty and IM is zero', () => {
    const { container } = render(
      <ReferenceCsaTile
        cpty="Citi"
        summary={{
          count: 1,
          configured: true,
          ownPosted: 0,
          cptyPosted: 0,
          exposure: 0,
          state: 'Active',
          regulatorHints: [],
          phase: 'live',
          isFetching: false,
          isdaMasterAgreementRef: '',
          governingLaw: 'NewYork',
          imAmount: 0,
          valuationCcy: 'USD',
        }}
      />,
    )
    const isdaRow = container.querySelector('[data-testid="csa-tile-isda-row"]')
    expect(isdaRow?.textContent).toContain('ISDA: —')
    expect(isdaRow?.textContent).toContain('NY law')
    const imRow = container.querySelector('[data-testid="csa-tile-im-row"]')
    expect(imRow?.textContent).toContain('—')
  })

  test('delegates cpty rendering to PartyName so the directory can resolve displayName', () => {
    const { getByTestId } = render(
      <ReferenceCsaTile
        cpty="JPMorgan"
        summary={{
          count: 1,
          configured: true,
          ownPosted: 5_000_000,
          cptyPosted: 0,
          exposure: 5_000_000,
          state: 'Active',
          regulatorHints: [],
          phase: 'live',
          isFetching: false,
          isdaMasterAgreementRef: '',
          governingLaw: 'NewYork',
          imAmount: 0,
          valuationCcy: 'USD',
        }}
      />,
    )
    const node = getByTestId('party-name')
    expect(node.textContent).toBe('<JPMorgan>')
  })
})
