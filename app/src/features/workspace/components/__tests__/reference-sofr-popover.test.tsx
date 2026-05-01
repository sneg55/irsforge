import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { ReferenceSofrPopover } from '../reference-sofr-popover'

afterEach(() => cleanup())

describe('ReferenceSofrPopover', () => {
  test('renders pillar rows with reverse-looked-up tenor labels', () => {
    const curve = {
      asOf: '2026-04-21T12:00:00Z',
      currency: 'USD',
      curveType: 'Discount' as const,
      indexId: null,
      pillars: [
        { tenorDays: 30, zeroRate: 0.043 },
        { tenorDays: 365, zeroRate: 0.0428 },
      ],
      interpolation: 'LinearZero' as const,
      dayCount: 'Act360' as const,
    }
    const { container } = render(<ReferenceSofrPopover curve={curve} history={[]} />)
    // 30d → "1M" via TENOR_DAYS_MAP; 365d → "1Y"
    expect(container.textContent).toContain('1M')
    expect(container.textContent).toContain('1Y')
    expect(container.textContent).toContain('USD')
  })

  test('falls back to Nd for unknown tenorDays', () => {
    const curve = {
      asOf: '2026-04-21T12:00:00Z',
      currency: 'USD',
      curveType: 'Discount' as const,
      indexId: null,
      pillars: [{ tenorDays: 42, zeroRate: 0.04 }],
      interpolation: 'LinearZero' as const,
      dayCount: 'Act360' as const,
    }
    const { container } = render(<ReferenceSofrPopover curve={curve} history={[]} />)
    expect(container.textContent).toContain('42d')
  })
})
