import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurrencyOptions } from '../use-currency-options'

// Mock the config context to control which currencies the hook sees.
const mockUseConfig = vi.fn()
vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => mockUseConfig(),
}))

describe('useCurrencyOptions', () => {
  beforeEach(() => {
    mockUseConfig.mockReset()
  })

  it('returns an empty list while config is still loading', () => {
    mockUseConfig.mockReturnValue({ config: null, loading: true, getOrg: () => undefined })
    const { result } = renderHook(() => useCurrencyOptions())
    expect(result.current).toEqual([])
  })

  it('returns an empty list when config has no currencies field', () => {
    mockUseConfig.mockReturnValue({
      config: { orgs: [] },
      loading: false,
      getOrg: () => undefined,
    })
    const { result } = renderHook(() => useCurrencyOptions())
    expect(result.current).toEqual([])
  })

  it('maps each configured currency to a { label, value } option', () => {
    mockUseConfig.mockReturnValue({
      config: {
        currencies: [
          { code: 'USD', label: 'US Dollar', isDefault: true },
          { code: 'EUR', label: 'Euro', isDefault: false },
          { code: 'GBP', label: 'British Pound', isDefault: false },
        ],
      },
      loading: false,
      getOrg: () => undefined,
    })
    const { result } = renderHook(() => useCurrencyOptions())
    expect(result.current).toEqual([
      { label: 'USD', value: 'USD' },
      { label: 'EUR', value: 'EUR' },
      { label: 'GBP', value: 'GBP' },
    ])
  })

  it('reflects exactly the currencies from config — no hardcoded G10 drift', () => {
    // Regression guard: Phase 0 Step 2 killed the hardcoded G10 list in
    // `features/workspace/constants/currencies.ts`. If config only seeds
    // USD/EUR, the UI must not offer JPY/GBP/etc.
    mockUseConfig.mockReturnValue({
      config: {
        currencies: [
          { code: 'USD', label: 'US Dollar', isDefault: true },
          { code: 'EUR', label: 'Euro', isDefault: false },
        ],
      },
      loading: false,
      getOrg: () => undefined,
    })
    const { result } = renderHook(() => useCurrencyOptions())
    const codes = result.current.map((o) => o.value)
    expect(codes).toEqual(['USD', 'EUR'])
    expect(codes).not.toContain('JPY')
    expect(codes).not.toContain('GBP')
  })
})
