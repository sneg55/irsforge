import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CollateralZone } from '../collateral-zone'

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

afterEach(cleanup)

describe('CollateralZone', () => {
  it('renders healthy pill when CSA state is Active and coverage ≥ 100%', () => {
    const { container } = render(
      <CollateralZone
        configured={true}
        ownPosted={10_000_000}
        cptyPosted={0}
        exposure={5_000_000}
        state="Active"
      />,
    )
    const pill = container.querySelector('[data-testid="status-pill"]')
    expect(pill!.textContent).toContain('Healthy')
    expect(pill!.className).toContain('text-green-400')
    expect(container.querySelector('[data-testid="headroom-pct"]')!.textContent).toBe('200%')
  })

  it('renders warn pill when coverage in [80%, 100%)', () => {
    const { container } = render(
      <CollateralZone
        configured={true}
        ownPosted={8_500_000}
        cptyPosted={0}
        exposure={10_000_000}
        state="Active"
      />,
    )
    const pill = container.querySelector('[data-testid="status-pill"]')
    expect(pill!.textContent).toContain('Warn')
    expect(container.querySelector('[data-testid="headroom-pct"]')!.textContent).toBe('85%')
  })

  it('renders Margin Call pill when ledger state is MarginCallOutstanding', () => {
    const { container } = render(
      <CollateralZone
        configured={true}
        ownPosted={0}
        cptyPosted={10_000_000}
        exposure={9_500_000}
        state="MarginCallOutstanding"
      />,
    )
    const pill = container.querySelector('[data-testid="status-pill"]')
    expect(pill!.textContent).toContain('Margin Call')
    expect(pill!.className).toContain('text-red-400')
  })

  it('renders Disputed pill when ledger state is MarkDisputed', () => {
    const { container } = render(
      <CollateralZone
        configured={true}
        ownPosted={5_000_000}
        cptyPosted={5_000_000}
        exposure={2_000_000}
        state="MarkDisputed"
      />,
    )
    const pill = container.querySelector('[data-testid="status-pill"]')
    expect(pill!.textContent).toContain('Disputed')
  })

  it('renders "Awaiting mark" (not "Call") when state is Active but no mark is published', () => {
    const { container } = render(
      <CollateralZone
        configured={true}
        ownPosted={0}
        cptyPosted={0}
        exposure={null}
        state="Active"
      />,
    )
    const pill = container.querySelector('[data-testid="status-pill"]')
    expect(pill!.textContent).toContain('Awaiting mark')
    expect(container.querySelector('[data-testid="headroom-pct"]')!.textContent).toBe('—')
  })

  it('sets bar fill from coverage fraction; 80% exposure coverage → 80%', () => {
    const { container } = render(
      <CollateralZone
        configured={true}
        ownPosted={8_000_000}
        cptyPosted={0}
        exposure={10_000_000}
        state="Active"
      />,
    )
    const fill = container.querySelector('[data-testid="bar-fill"]') as HTMLElement
    expect(fill.style.width).toBe('80%')
  })

  it('renders "No CSA configured" when configured=false', () => {
    const { container } = render(
      <CollateralZone
        configured={false}
        ownPosted={0}
        cptyPosted={0}
        exposure={null}
        state="Active"
      />,
    )
    expect(container.textContent).toContain('No CSA configured')
    expect(container.querySelector('[data-testid="status-pill"]')).toBeNull()
    expect(container.querySelector('[data-testid="bar-fill"]')).toBeNull()
  })

  it('shows both sides of the posted stack and the signed exposure caption', () => {
    const { container } = render(
      <CollateralZone
        configured={true}
        ownPosted={0}
        cptyPosted={10_000_000}
        exposure={-9_500_000}
        state="Active"
      />,
    )
    expect(container.querySelector('[data-testid="posted-amount"]')!.textContent).toBe('$0 mine')
    expect(container.querySelector('[data-testid="cpty-posted-amount"]')!.textContent).toBe(
      '$10M cpty',
    )
    const exposureLine = container.querySelector('[data-testid="exposure-line"]') as HTMLElement
    expect(exposureLine.textContent).toContain('$9.5M')
    expect(exposureLine.textContent).toContain('cpty owes me')
  })

  it('renders "—" coverage when active party is in-the-money (exposure < 0)', () => {
    const { container } = render(
      <CollateralZone
        configured={true}
        ownPosted={0}
        cptyPosted={10_000_000}
        exposure={-9_500_000}
        state="Active"
      />,
    )
    // No coverage ratio from own-posted stack is meaningful when cpty is the obligor.
    expect(container.querySelector('[data-testid="headroom-pct"]')!.textContent).toBe('—')
  })

  it('renders the regulator pill listing observing regulator hints', () => {
    const { container } = render(
      <CollateralZone
        configured={true}
        ownPosted={5_000_000}
        cptyPosted={0}
        exposure={4_000_000}
        state="Active"
        regulatorHints={['RegulatorEU', 'RegulatorUS']}
      />,
    )
    const line = container.querySelector('[data-testid="regulator-line"]')
    expect(line).not.toBeNull()
    expect(line!.textContent).toContain('Regulator')
    expect(line!.textContent).toContain('RegulatorEU, RegulatorUS')

    const tooltip = container.querySelector('[data-testid="regulator-tooltip"]')
    expect(tooltip).not.toBeNull()
    expect(tooltip!.getAttribute('role')).toBe('tooltip')
    expect(tooltip!.textContent).toContain('Regulators observing')
    expect(tooltip!.textContent).toContain('RegulatorEU')
    expect(tooltip!.textContent).toContain('RegulatorUS')
  })

  it('omits the regulator pill when no regulators are observing', () => {
    const { container } = render(
      <CollateralZone
        configured={true}
        ownPosted={5_000_000}
        cptyPosted={0}
        exposure={4_000_000}
        state="Active"
        regulatorHints={[]}
      />,
    )
    expect(container.querySelector('[data-testid="regulator-line"]')).toBeNull()
  })
})
