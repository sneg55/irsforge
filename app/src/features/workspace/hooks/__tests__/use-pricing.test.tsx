import type { DiscountCurve, SwapConfig } from '@irsforge/shared-pricing'
import { renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { usePricing } from '../use-pricing'

vi.mock('@irsforge/shared-pricing', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    pricingEngine: { price: () => ({ npv: 42, dv01: 1, cashflows: [], legPVs: [] }) },
  }
})

const curve: DiscountCurve = {
  currency: 'USD',
  curveType: 'Discount',
  indexId: null,
  asOf: '2026-04-15',
  pillars: [{ tenorDays: 365, zeroRate: 0.04 }],
  interpolation: 'LinearZero',
  dayCount: 'Act360',
}

describe('usePricing', () => {
  test('null when swapConfig is null', () => {
    const { result } = renderHook(() => usePricing(null, curve))
    expect(result.current.valuation).toBeNull()
  })

  test('null when curve is null', () => {
    const cfg = { legs: [{}] } as unknown as SwapConfig
    const { result } = renderHook(() => usePricing(cfg, null))
    expect(result.current.valuation).toBeNull()
  })

  test('null when legs are empty', () => {
    const cfg = { legs: [] } as unknown as SwapConfig
    const { result } = renderHook(() => usePricing(cfg, curve))
    expect(result.current.valuation).toBeNull()
  })

  test('returns engine result when inputs complete', () => {
    const cfg = { legs: [{ legType: 'fixed' }] } as unknown as SwapConfig
    const { result } = renderHook(() => usePricing(cfg, curve))
    expect(result.current.valuation?.npv).toBe(42)
  })
})
