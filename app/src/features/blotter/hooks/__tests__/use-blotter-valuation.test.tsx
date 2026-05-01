import type { DiscountCurve } from '@irsforge/shared-pricing'
import { renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useBlotterValuation } from '../use-blotter-valuation'

// Stub pricing engine so we just observe that hook iterates config maps.
vi.mock('@irsforge/shared-pricing', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    pricingEngine: {
      price: () => ({ npv: 1000, dv01: 50 }),
    },
    streamsToParsedFpml: () => ({}) as unknown,
    parsedFpmlToSwapConfig: () => null,
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

function irsWorkflow(cid: string, instrId: string) {
  return {
    contractId: cid,
    payload: {
      partyA: 'A',
      partyB: 'B',
      swapType: 'IRS',
      notional: '1000000',
      instrumentKey: { id: { unpack: instrId } },
    },
  } as unknown as Parameters<typeof useBlotterValuation>[0][number]
}

function irsInstrument() {
  return {
    swapType: 'IRS',
    payload: {
      currency: { id: { unpack: 'USD' } },
      periodicSchedule: {
        effectiveDate: '2026-04-15',
        terminationDate: '2027-04-15',
      },
      fixRate: '0.04',
      dayCountConvention: 'Act360',
      floatingRate: { referenceRateId: 'USD-SOFR' },
    },
  } as unknown as Parameters<typeof useBlotterValuation>[1] extends Map<string, infer T> ? T : never
}

describe('useBlotterValuation', () => {
  test('returns empty map when curve is null', () => {
    const { result } = renderHook(() => useBlotterValuation([], new Map(), null, null, {}, []))
    expect(result.current.size).toBe(0)
  })

  test('prices an IRS workflow and writes npv+dv01+sparkline', () => {
    const map = new Map([['instr-1', irsInstrument()]])
    const { result } = renderHook(() =>
      useBlotterValuation([irsWorkflow('c1', 'instr-1')], map, curve, null, {}, []),
    )
    const v = result.current.get('c1')
    expect(v?.npv).toBe(1000)
    expect(v?.dv01).toBe(50)
    expect(v?.sparkline.length).toBe(1)
  })

  test('skips workflow when its instrument is missing from the map', () => {
    const { result } = renderHook(() =>
      useBlotterValuation([irsWorkflow('c1', 'not-in-map')], new Map(), curve, null, {}, []),
    )
    expect(result.current.size).toBe(0)
  })

  test('uses curveHistory slice when non-empty (sparkline grows)', () => {
    const map = new Map([['instr-1', irsInstrument()]])
    const history: DiscountCurve[] = [
      curve,
      { ...curve, asOf: '2026-04-16' },
      { ...curve, asOf: '2026-04-17' },
    ]
    const { result } = renderHook(() =>
      useBlotterValuation([irsWorkflow('c1', 'instr-1')], map, curve, null, {}, history),
    )
    expect(result.current.get('c1')?.sparkline.length).toBe(3)
  })
})
