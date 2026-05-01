import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOperatorPolicies } from '@/features/operator/hooks/use-operator-policies'
import { useOperatorPolicy } from './use-operator-policy'

vi.mock('@/features/operator/hooks/use-operator-policies', () => ({
  useOperatorPolicies: vi.fn(),
}))

const mocked = vi.mocked(useOperatorPolicies)

const baseResult = {
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: () => {},
}

describe('useOperatorPolicy', () => {
  beforeEach(() => mocked.mockReset())

  it('returns "auto" when no policy contracts are present', () => {
    mocked.mockReturnValue({ ...baseResult, rows: [] })
    const { result } = renderHook(() => useOperatorPolicy('CDS'))
    expect(result.current).toBe('auto')
  })

  it('returns "auto" when family is not represented in the policy set', () => {
    mocked.mockReturnValue({
      ...baseResult,
      rows: [{ contractId: 'cid-irs', family: 'IRS', mode: 'manual' }],
    })
    const { result } = renderHook(() => useOperatorPolicy('CDS'))
    expect(result.current).toBe('auto')
  })

  it('returns "manual" when the family policy is on-ledger as Manual', () => {
    mocked.mockReturnValue({
      ...baseResult,
      rows: [{ contractId: 'cid-cds', family: 'CDS', mode: 'manual' }],
    })
    const { result } = renderHook(() => useOperatorPolicy('CDS'))
    expect(result.current).toBe('manual')
  })
})
