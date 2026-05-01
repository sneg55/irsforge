import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ReferenceStrip } from '../reference-strip'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/org/goldman/workspace',
}))

afterEach(() => cleanup())
describe('ReferenceStrip', () => {
  test('renders both tiles side-by-side', () => {
    const { container } = render(
      <ReferenceStrip
        curve={null}
        history={[]}
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
    expect(container.querySelector('[data-testid="sofr-tile"]')).not.toBeNull()
    expect(container.textContent).toContain('No CSA')
  })
})
