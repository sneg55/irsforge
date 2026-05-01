import type { DiscountCurve } from '@irsforge/shared-pricing'
import { renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import type { ContractResult, SwapWorkflow } from '@/shared/ledger/types'
import { IRS_INSTR, instrKey } from '../__tests__/mapper-fixtures'
import { useBlotterValuation } from './use-blotter-valuation'

function makeCurve(asOf: string, bump = 0): DiscountCurve {
  return {
    currency: 'USD',
    curveType: 'Discount',
    indexId: null,
    asOf,
    pillars: [
      { tenorDays: 91, zeroRate: 0.0431 + bump },
      { tenorDays: 365, zeroRate: 0.0415 + bump },
      { tenorDays: 1826, zeroRate: 0.0387 + bump },
    ],
    interpolation: 'LinearZero',
    dayCount: 'Act360',
  }
}

function makeWorkflow(id: string, instrId: string): ContractResult<SwapWorkflow> {
  return {
    contractId: id,
    payload: {
      instrumentKey: instrKey(instrId),
      swapType: 'IRS',
      partyA: 'PartyA',
      partyB: 'PartyB',
      operator: 'Op',
      regulators: ['Reg'],
      scheduler: 'Sch',
      notional: '10000000',
      underlyings: [],
      fixingEffects: [],
      settleEffects: [],
      terminationEffect: null,
      maturityEffect: null,
      unwindProposal: null,
    } as SwapWorkflow,
  }
}

describe('useBlotterValuation — sparkline', () => {
  test('returns empty Map when curve is null', () => {
    const workflows = [makeWorkflow('c1', 'IRS-1')]
    const byInstr = new Map<string, SwapInstrumentPayload>([['IRS-1', IRS_INSTR]])
    const { result } = renderHook(() => useBlotterValuation(workflows, byInstr, null, null, {}, []))
    expect(result.current.size).toBe(0)
  })

  test('single-curve valuation collapses sparkline to [currentNpv] when no history', () => {
    const curve = makeCurve('2026-04-15T00:00:00Z')
    const workflows = [makeWorkflow('c1', 'IRS-1')]
    const byInstr = new Map<string, SwapInstrumentPayload>([['IRS-1', IRS_INSTR]])
    const { result } = renderHook(() => useBlotterValuation(workflows, byInstr, curve, null, {}))
    const row = result.current.get('c1')
    expect(row).toBeDefined()
    expect(row!.sparkline).toHaveLength(1)
    expect(row!.sparkline[0]).toBe(row!.npv)
  })

  test('sparkline has one entry per curve in history (capped at maxSparklinePoints)', () => {
    const curve = makeCurve('2026-04-15T00:00:00Z')
    const history = [
      makeCurve('2026-04-15T00:00:00Z', 0),
      makeCurve('2026-04-15T01:00:00Z', +0.0001),
      makeCurve('2026-04-15T02:00:00Z', +0.0002),
      makeCurve('2026-04-15T03:00:00Z', +0.0003),
    ]
    const workflows = [makeWorkflow('c1', 'IRS-1')]
    const byInstr = new Map<string, SwapInstrumentPayload>([['IRS-1', IRS_INSTR]])
    const { result } = renderHook(() =>
      useBlotterValuation(workflows, byInstr, curve, null, {}, history),
    )
    const row = result.current.get('c1')
    expect(row!.sparkline).toHaveLength(4)
  })

  test('respects maxSparklinePoints by slicing the tail', () => {
    const curve = makeCurve('2026-04-15T00:00:00Z')
    const history = Array.from({ length: 50 }, (_, i) =>
      makeCurve(`2026-04-15T${String(i).padStart(2, '0')}:00:00Z`, i * 1e-5),
    )
    const workflows = [makeWorkflow('c1', 'IRS-1')]
    const byInstr = new Map<string, SwapInstrumentPayload>([['IRS-1', IRS_INSTR]])
    const { result } = renderHook(() =>
      useBlotterValuation(workflows, byInstr, curve, null, {}, history, 10),
    )
    const row = result.current.get('c1')
    expect(row!.sparkline).toHaveLength(10)
  })
})
