import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ExposureHeader, ExposureHeaderSkeleton } from '../index'
import type { ExposureHeaderData } from '../types'

// Zone components render internal state; just stub so container assertion works.
vi.mock('../risk-zone', () => ({
  RiskZone: ({ npv }: { npv: number }) => <div data-testid="risk">NPV:{npv}</div>,
}))
vi.mock('../volume-zone', () => ({
  VolumeZone: ({ notional }: { notional: number }) => <div data-testid="vol">N:{notional}</div>,
}))
vi.mock('../collateral-zone', () => ({
  CollateralZone: ({ configured }: { configured: boolean }) => (
    <div data-testid="coll">C:{String(configured)}</div>
  ),
}))

afterEach(() => cleanup())

const data: ExposureHeaderData = {
  bookNpv: 12345,
  bookDv01: 100,
  totalNotional: 1_000_000,
  activeSwaps: 3,
  swapCountByType: { IRS: 2, CDS: 1 },
  csa: {
    configured: true,
    ownPosted: 500,
    cptyPosted: 700,
    exposure: 200,
    state: 'Active',
    regulatorHints: [],
  },
}

describe('ExposureHeader', () => {
  test('renders skeleton when loading', () => {
    const { container } = render(<ExposureHeaderSkeleton />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  test('isLoading=true renders skeleton', () => {
    const { container } = render(<ExposureHeader data={data} isLoading />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  test('renders three zones with props', () => {
    const { getByTestId } = render(<ExposureHeader data={data} />)
    expect(getByTestId('risk').textContent).toContain('12345')
    expect(getByTestId('vol').textContent).toContain('1000000')
    expect(getByTestId('coll').textContent).toContain('true')
  })
})
