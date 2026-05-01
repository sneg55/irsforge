import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { SwapConfig } from '../../types'
import { usePricingInputs } from '../use-pricing-inputs'

// Stub every underlying data hook so no real ledger/WS calls happen.
const useOracleCurveMock = vi.fn<() => { curve: unknown }>(() => ({ curve: null }))
const useCurveBookMock = vi.fn<() => { data: unknown }>(() => ({ data: undefined }))
const useFxSpotsMock = vi.fn<() => { data: unknown }>(() => ({ data: undefined }))
const useFloatingRateIndexMock = vi.fn<(id: string) => { data: unknown }>(() => ({
  data: undefined,
}))
const useObservationsMock = vi.fn<(id: string | null) => { data: unknown }>(() => ({
  data: undefined,
}))
const useCurveStreamMock = vi.fn<
  () => { history: unknown[]; status: 'idle' | 'connecting' | 'open' | 'error' }
>(() => ({ history: [], status: 'idle' }))

vi.mock('@/shared/hooks/use-oracle-curve', () => ({
  useOracleCurve: () => useOracleCurveMock(),
}))
vi.mock('@/shared/ledger/useFloatingRateIndex', () => ({
  useFloatingRateIndex: (id: string) => useFloatingRateIndexMock(id),
}))
vi.mock('@/shared/ledger/useObservations', () => ({
  useObservations: (id: string | null) => useObservationsMock(id),
}))
vi.mock('@/shared/ledger/useCurveBook', () => ({
  useCurveBook: () => useCurveBookMock(),
}))
vi.mock('@/shared/ledger/useFxSpots', () => ({
  useFxSpots: () => useFxSpotsMock(),
}))
vi.mock('@/shared/ledger/useCurveStream', () => ({
  useCurveStream: () => useCurveStreamMock(),
}))

function makeIrsConfig(): SwapConfig {
  return {
    type: 'IRS',
    legs: [
      {
        legType: 'fixed' as const,
        direction: 'receive' as const,
        currency: 'USD',
        notional: 10_000_000,
        rate: 0.045,
        dayCount: 'ACT_360',
        schedule: {
          startDate: new Date('2026-04-03T00:00:00Z'),
          endDate: new Date('2027-04-03T00:00:00Z'),
          frequency: 'Quarterly',
        },
      },
      {
        legType: 'float' as const,
        direction: 'pay' as const,
        currency: 'USD',
        notional: 10_000_000,
        indexId: 'USD-SOFR',
        spread: 0,
        dayCount: 'ACT_360',
        schedule: {
          startDate: new Date('2026-04-03T00:00:00Z'),
          endDate: new Date('2027-04-03T00:00:00Z'),
          frequency: 'Quarterly',
        },
      },
    ],
    tradeDate: new Date('2026-04-01T00:00:00Z'),
    effectiveDate: new Date('2026-04-03T00:00:00Z'),
    maturityDate: new Date('2027-04-03T00:00:00Z'),
  }
}

describe('usePricingInputs', () => {
  it('returns null pricingCtx when curve data is missing', () => {
    const { result } = renderHook(() => usePricingInputs(makeIrsConfig()))
    expect(result.current.pricingCtx).toBeNull()
    expect(result.current.curve).toBeNull()
    expect(result.current.observations).toEqual([])
    expect(result.current.fxSpots).toEqual({})
    expect(result.current.streamStatus).toBe('idle')
    expect(result.current.curveHistory).toEqual([])
  })

  it('builds pricingCtx with curve + creditSpread default when curve is available', () => {
    useOracleCurveMock.mockReturnValueOnce({
      curve: { currency: 'USD', asOf: '2026-04-21', nodes: [] } as any,
    })
    const cfg = makeIrsConfig()
    const { result } = renderHook(() => usePricingInputs(cfg))
    expect(result.current.pricingCtx).not.toBeNull()
    expect(result.current.pricingCtx?.creditSpread).toBe(0.02)
  })

  it('uses swapConfig.creditSpread when provided', () => {
    useOracleCurveMock.mockReturnValueOnce({
      curve: { currency: 'USD', asOf: 'x', nodes: [] } as any,
    })
    const cfg = { ...makeIrsConfig(), creditSpread: 0.035 } as SwapConfig
    const { result } = renderHook(() => usePricingInputs(cfg))
    expect(result.current.pricingCtx?.creditSpread).toBe(0.035)
  })

  it('returns undefined indicesByLeg when swapConfig is null', () => {
    const { result } = renderHook(() => usePricingInputs(null))
    expect(result.current.indicesByLeg).toBeUndefined()
  })

  it('builds indicesByLeg with nulls for non-float legs', () => {
    useFloatingRateIndexMock.mockReturnValue({
      data: {
        indexId: 'USD-SOFR',
        currency: 'USD',
        family: 'SOFR',
        compounding: 'Compounded',
        lookback: 2,
        floor: null,
      },
    })
    const { result } = renderHook(() => usePricingInputs(makeIrsConfig()))
    expect(result.current.indicesByLeg).toHaveLength(2)
    expect(result.current.indicesByLeg?.[0]).toBeNull() // fixed leg
    expect(result.current.indicesByLeg?.[1]?.indexId).toBe('USD-SOFR')
  })
})
