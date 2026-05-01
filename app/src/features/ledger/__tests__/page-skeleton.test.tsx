import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('../contexts/ledger-activity-provider', () => ({
  useLedgerActivityContext: () => ({
    events: [],
    enabled: true,
    denyPrefixes: [],
    allowPrefixes: [],
    systemPrefixes: [],
    phase: 'initial',
  }),
}))
vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => ({ config: { ledgerUi: { rawPayload: { enabled: true } } } }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import LedgerPage from '../page'

afterEach(() => cleanup())

describe('LedgerPage loading state', () => {
  test('renders skeleton rows on initial connect', () => {
    const { container } = render(<LedgerPage />)
    const rows = container.querySelectorAll('[data-slot="ledger-skeleton-row"]')
    expect(rows.length).toBeGreaterThanOrEqual(5)
  })
})
