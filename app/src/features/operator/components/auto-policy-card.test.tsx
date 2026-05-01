import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../hooks/use-operator-policies', () => ({
  OPERATOR_POLICIES_QUERY_KEY: 'operator-policies',
  useOperatorPolicies: vi.fn(),
}))

vi.mock('@/shared/hooks/use-active-org-role', () => ({
  useActiveOrgRole: vi.fn(),
}))

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: vi.fn(),
}))

vi.mock('../ledger/set-policy-mode', () => ({
  setOperatorPolicyMode: vi.fn(),
}))

import { useActiveOrgRole } from '@/shared/hooks/use-active-org-role'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { useOperatorPolicies } from '../hooks/use-operator-policies'
import { setOperatorPolicyMode } from '../ledger/set-policy-mode'
import { AutoPolicyCard } from './auto-policy-card'

const mockedUseOperatorPolicies = vi.mocked(useOperatorPolicies)
const mockedUseActiveOrgRole = vi.mocked(useActiveOrgRole)
const mockedUseLedgerClient = vi.mocked(useLedgerClient)
const mockedSetOperatorPolicyMode = vi.mocked(setOperatorPolicyMode)

const baseHookResult = {
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: () => {},
}

function rowsForAllAuto(): Array<{
  contractId: string
  family: 'IRS' | 'OIS' | 'BASIS' | 'XCCY' | 'CDS' | 'CCY' | 'FX' | 'ASSET' | 'FpML'
  mode: 'auto' | 'manual'
}> {
  return ['IRS', 'OIS', 'BASIS', 'XCCY', 'CDS', 'CCY', 'FX', 'ASSET', 'FpML'].map((family) => ({
    contractId: `cid-${family}`,
    family: family as 'IRS',
    mode: 'auto' as const,
  }))
}

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('AutoPolicyCard', () => {
  beforeEach(() => {
    mockedUseOperatorPolicies.mockReset()
    mockedUseActiveOrgRole.mockReset()
    mockedUseLedgerClient.mockReset()
    mockedSetOperatorPolicyMode.mockReset()
    mockedUseLedgerClient.mockReturnValue({
      client: { exercise: vi.fn() } as never,
      activeParty: 'Operator',
    })
  })

  it('renders 9 rows, one per swap family, in fixed order', () => {
    mockedUseActiveOrgRole.mockReturnValue('operator')
    mockedUseOperatorPolicies.mockReturnValue({ ...baseHookResult, rows: rowsForAllAuto() })
    const { container } = wrap(<AutoPolicyCard />)
    const rows = container.querySelectorAll('[data-testid^="auto-policy-row-"]')
    expect(rows.length).toBe(9)
    expect(rows[0].getAttribute('data-testid')).toBe('auto-policy-row-IRS')
    expect(rows[8].getAttribute('data-testid')).toBe('auto-policy-row-FpML')
  })

  it('toggles disabled when role is not operator', () => {
    mockedUseActiveOrgRole.mockReturnValue('trader')
    mockedUseOperatorPolicies.mockReturnValue({ ...baseHookResult, rows: rowsForAllAuto() })
    const { container } = wrap(<AutoPolicyCard />)
    const toggles = container.querySelectorAll(
      'button[data-testid^="auto-policy-toggle-"]',
    ) as NodeListOf<HTMLButtonElement>
    expect(toggles.length).toBe(9)
    for (const t of toggles) expect(t.disabled).toBe(true)
  })

  it('clicking auto toggle exercises SetMode with newMode=manual and triggers refetch', async () => {
    mockedUseActiveOrgRole.mockReturnValue('operator')
    mockedUseOperatorPolicies.mockReturnValue({ ...baseHookResult, rows: rowsForAllAuto() })
    mockedSetOperatorPolicyMode.mockResolvedValue(undefined)
    const { container } = wrap(<AutoPolicyCard />)
    const toggle = container.querySelector(
      '[data-testid="auto-policy-toggle-CDS"]',
    ) as HTMLButtonElement
    fireEvent.click(toggle)
    await waitFor(() => expect(mockedSetOperatorPolicyMode).toHaveBeenCalledTimes(1))
    const args = mockedSetOperatorPolicyMode.mock.calls[0][1]
    expect(args).toEqual({ contractId: 'cid-CDS', newMode: 'manual' })
  })

  it('renders the action error block when SetMode rejects', async () => {
    mockedUseActiveOrgRole.mockReturnValue('operator')
    mockedUseOperatorPolicies.mockReturnValue({ ...baseHookResult, rows: rowsForAllAuto() })
    mockedSetOperatorPolicyMode.mockRejectedValue(new Error('exercise failed'))
    const { container } = wrap(<AutoPolicyCard />)
    fireEvent.click(
      container.querySelector('[data-testid="auto-policy-toggle-IRS"]') as HTMLButtonElement,
    )
    await waitFor(() => {
      const err = container.querySelector('[data-testid="auto-policy-action-error"]')
      expect(err?.textContent).toContain('exercise failed')
    })
  })

  it('shows "no policy contract" when a family has no on-ledger row', () => {
    mockedUseActiveOrgRole.mockReturnValue('operator')
    mockedUseOperatorPolicies.mockReturnValue({
      ...baseHookResult,
      rows: [{ contractId: 'cid-IRS', family: 'IRS', mode: 'auto' }],
    })
    const { container } = wrap(<AutoPolicyCard />)
    const cdsRow = container.querySelector('[data-testid="auto-policy-row-CDS"]')
    expect(cdsRow?.textContent).toContain('no policy contract')
    const cdsBtn = container.querySelector(
      '[data-testid="auto-policy-toggle-CDS"]',
    ) as HTMLButtonElement
    expect(cdsBtn.disabled).toBe(true)
  })
})
