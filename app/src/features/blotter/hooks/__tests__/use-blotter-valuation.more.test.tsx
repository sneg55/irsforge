import type { CurveBook, DiscountCurve } from '@irsforge/shared-pricing'
import { renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useBlotterValuation } from '../use-blotter-valuation'

vi.mock('@irsforge/shared-pricing', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    pricingEngine: { price: () => ({ npv: 100, dv01: 5 }) },
    streamsToParsedFpml: () => ({}),
    parsedFpmlToSwapConfig: () => ({
      type: 'FpML',
      legs: [],
      tradeDate: new Date(),
      effectiveDate: new Date(),
      maturityDate: new Date(),
    }),
  }
})

const curve: DiscountCurve = {
  currency: 'USD',
  curveType: 'Discount',
  indexId: null,
  asOf: '2026-04-15T00:00:00Z',
  pillars: [{ tenorDays: 365, zeroRate: 0.04 }],
  interpolation: 'LinearZero',
  dayCount: 'Act360',
}

function wf(cid: string, instrId: string, swapType: string) {
  return {
    contractId: cid,
    payload: {
      partyA: 'A',
      partyB: 'B',
      swapType,
      notional: '1000',
      instrumentKey: { id: { unpack: instrId } },
    },
  } as unknown as Parameters<typeof useBlotterValuation>[0][number]
}

function cdsInstrument() {
  return {
    swapType: 'CDS',
    payload: {
      currency: { id: { unpack: 'USD' } },
      periodicSchedule: { effectiveDate: '2026-04-15', terminationDate: '2027-04-15' },
      fixRate: '0.01',
      dayCountConvention: 'Act360',
    },
  } as unknown as Parameters<typeof useBlotterValuation>[1] extends Map<string, infer T> ? T : never
}
function ccyInstrument() {
  return {
    swapType: 'CCY',
    payload: {
      baseCurrency: { id: { unpack: 'USD' } },
      foreignCurrency: { id: { unpack: 'EUR' } },
      periodicSchedule: { effectiveDate: '2026-04-15', terminationDate: '2027-04-15' },
      fxRate: '0.9',
      baseRate: '0.04',
      foreignRate: '0.03',
      dayCountConvention: 'Act360',
    },
  } as unknown as Parameters<typeof useBlotterValuation>[1] extends Map<string, infer T> ? T : never
}
function fxInstrument() {
  return {
    swapType: 'FX',
    payload: {
      baseCurrency: { id: { unpack: 'USD' } },
      foreignCurrency: { id: { unpack: 'EUR' } },
      issueDate: '2026-04-15',
      maturityDate: '2027-04-15',
      firstPaymentDate: '2026-04-16',
      firstFxRate: '0.9',
      finalFxRate: '0.92',
    },
  } as unknown as Parameters<typeof useBlotterValuation>[1] extends Map<string, infer T> ? T : never
}
function assetInstrument() {
  return {
    swapType: 'ASSET',
    payload: {
      currency: { id: { unpack: 'USD' } },
      periodicSchedule: { effectiveDate: '2026-04-15', terminationDate: '2027-04-15' },
      fixRate: '0.04',
      dayCountConvention: 'Act360',
      underlyings: [{ referenceAssetId: 'AAPL', weight: '1.0', initialPrice: '100.0' }],
    },
  } as unknown as Parameters<typeof useBlotterValuation>[1] extends Map<string, infer T> ? T : never
}
function fpmlInstrument() {
  return {
    swapType: 'FpML',
    payload: { swapStreams: [] },
  } as unknown as Parameters<typeof useBlotterValuation>[1] extends Map<string, infer T> ? T : never
}

const book: CurveBook = { asOf: '2026-04-15', byCurrency: {} }

describe('useBlotterValuation — multi-type branches', () => {
  test('CDS → builds config with protection leg and prices', () => {
    const map = new Map([['i-1', cdsInstrument()]])
    const { result } = renderHook(() =>
      useBlotterValuation([wf('c1', 'i-1', 'CDS')], map, curve, book, {}, []),
    )
    expect(result.current.get('c1')?.npv).toBe(100)
  })

  test('CCY → builds two fixed legs', () => {
    const map = new Map([['i-2', ccyInstrument()]])
    const { result } = renderHook(() =>
      useBlotterValuation([wf('c2', 'i-2', 'CCY')], map, curve, null, {}, []),
    )
    expect(result.current.get('c2')?.npv).toBe(100)
  })

  test('FX → builds fx legs', () => {
    const map = new Map([['i-3', fxInstrument()]])
    const { result } = renderHook(() =>
      useBlotterValuation([wf('c3', 'i-3', 'FX')], map, curve, null, { EURUSD: 1.08 }, []),
    )
    expect(result.current.get('c3')?.npv).toBe(100)
  })

  test('ASSET → builds asset+fixed legs', () => {
    const map = new Map([['i-4', assetInstrument()]])
    const { result } = renderHook(() =>
      useBlotterValuation([wf('c4', 'i-4', 'ASSET')], map, curve, null, {}, []),
    )
    expect(result.current.get('c4')?.npv).toBe(100)
  })

  test('FpML → dispatches through parsedFpmlToSwapConfig', () => {
    const map = new Map([['i-5', fpmlInstrument()]])
    const { result } = renderHook(() =>
      useBlotterValuation([wf('c5', 'i-5', 'FpML')], map, curve, null, {}, []),
    )
    expect(result.current.get('c5')?.npv).toBe(100)
  })
})
