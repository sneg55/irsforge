import { describe, expect, test } from 'vitest'
import { SWAP_TYPE_CONFIGS } from '../../constants'
import { initialWorkspaceState, workspaceReducer } from '../use-workspace-reducer'

type TestLeg = {
  legType?: string
  notional?: number
  frequency?: unknown
  schedule?: { startDate: Date; endDate: Date; frequency?: string }
}

function init() {
  return initialWorkspaceState('draft-123')
}

describe('initialWorkspaceState', () => {
  test('returns draft mode with IRS defaults', () => {
    const s = init()
    expect(s.mode).toBe('draft')
    expect(s.swapType).toBe('IRS')
    expect(s.legs).toHaveLength(SWAP_TYPE_CONFIGS.IRS.defaultLegs.length)
    expect(s.draftId).toBe('draft-123')
    expect(s.contractId).toBeNull()
    expect(s.whatIfOriginal).toBeNull()
  })
})

describe('SET_SWAP_TYPE', () => {
  test('honored in draft mode, resets legs', () => {
    const s = workspaceReducer(init(), { type: 'SET_SWAP_TYPE', swapType: 'CDS' })
    expect(s.swapType).toBe('CDS')
    expect(s.legs[0]?.legType).toBe('fixed')
    expect(s.legs[1]?.legType).toBe('protection')
  })

  test('ignored in active mode', () => {
    const base = workspaceReducer(init(), { type: 'PROPOSE_SUCCESS', contractId: 'c1' })
    const s = workspaceReducer(base, { type: 'SET_SWAP_TYPE', swapType: 'CDS' })
    expect(s.swapType).toBe('IRS')
  })

  test('keeps leg schedule aligned with current dates', () => {
    const base = init()
    const s = workspaceReducer(base, { type: 'SET_SWAP_TYPE', swapType: 'IRS' })
    const leg0 = s.legs[0] as TestLeg
    expect(leg0.schedule?.startDate).toEqual(base.dates.effectiveDate)
    expect(leg0.schedule?.endDate).toEqual(base.dates.maturityDate)
  })
})

describe('SET_DATES', () => {
  test('valid tenor change updates dates and syncs leg schedules', () => {
    const base = init()
    const s = workspaceReducer(base, {
      type: 'SET_DATES',
      anchor: 'tenor',
      value: { years: 2, months: 0 },
    })
    expect(s.dates.tenor).toEqual({ years: 2, months: 0 })
    for (const leg of s.legs) {
      if ('schedule' in leg && leg.schedule) {
        expect(leg.schedule.startDate).toEqual(s.dates.effectiveDate)
        expect(leg.schedule.endDate).toEqual(s.dates.maturityDate)
      }
    }
  })

  test('invalid dates return prior state unchanged', () => {
    const base = init()
    const s = workspaceReducer(base, {
      type: 'SET_DATES',
      anchor: 'maturity',
      value: new Date(base.dates.effectiveDate.getTime() - 86400000),
    })
    expect(s).toBe(base) // referential equality — no change
  })
})

describe('UPDATE_LEG', () => {
  test('updates a top-level field', () => {
    const s = workspaceReducer(init(), {
      type: 'UPDATE_LEG',
      index: 0,
      field: 'notional',
      value: 99,
    })
    expect((s.legs[0] as TestLeg).notional).toBe(99)
  })

  test('frequency is written into schedule, not top-level', () => {
    const s = workspaceReducer(init(), {
      type: 'UPDATE_LEG',
      index: 0,
      field: 'frequency',
      value: 'Monthly',
    })
    expect((s.legs[0] as TestLeg).schedule?.frequency).toBe('Monthly')
    expect((s.legs[0] as TestLeg).frequency).toBeUndefined()
  })
})

describe('ADD_LEG / REMOVE_LEG / TOGGLE_DIRECTION', () => {
  test('ADD_LEG appends a default float leg', () => {
    const s = workspaceReducer(init(), { type: 'ADD_LEG' })
    expect(s.legs.length).toBe(3)
    expect(s.legs[2]?.legType).toBe('float')
  })

  test('REMOVE_LEG removes at index', () => {
    const s = workspaceReducer(init(), { type: 'REMOVE_LEG', index: 0 })
    expect(s.legs.length).toBe(1)
    expect(s.legs[0]?.legType).toBe('float')
  })

  test('TOGGLE_DIRECTION flips both legs pay <-> receive without reordering', () => {
    const base = init()
    // IRS defaults: legs[0]=fixed/receive, legs[1]=float/pay
    expect(base.legs[0]?.direction).toBe('receive')
    expect(base.legs[1]?.direction).toBe('pay')
    const s = workspaceReducer(base, { type: 'TOGGLE_DIRECTION' })
    expect(s.legs[0]?.direction).toBe('pay')
    expect(s.legs[1]?.direction).toBe('receive')
    expect(s.legs[0]?.legType).toBe(base.legs[0]?.legType) // no reorder
    expect(s.legs[1]?.legType).toBe(base.legs[1]?.legType)
  })

  test('TOGGLE_DIRECTION flips a single leg direction', () => {
    const one = workspaceReducer(init(), { type: 'REMOVE_LEG', index: 0 })
    // after removing leg 0 (fixed/receive), we have legs[0]=float/pay
    expect(one.legs[0]?.direction).toBe('pay')
    const s = workspaceReducer(one, { type: 'TOGGLE_DIRECTION' })
    expect(s.legs[0]?.direction).toBe('receive')
    expect(s.legs[0]?.legType).toBe(one.legs[0]?.legType)
  })

  test('ADD_LEG syncs new leg schedule to current workspace dates', () => {
    const base = init()
    const movedDates = workspaceReducer(base, {
      type: 'SET_DATES',
      anchor: 'tenor',
      value: { years: 2, months: 0 },
    })
    const s = workspaceReducer(movedDates, { type: 'ADD_LEG' })
    const newLeg = s.legs[s.legs.length - 1] as TestLeg
    expect(newLeg.schedule?.startDate).toEqual(movedDates.dates.effectiveDate)
    expect(newLeg.schedule?.endDate).toEqual(movedDates.dates.maturityDate)
  })
})

describe('whatIf flow', () => {
  test('ENTER_WHATIF from active snapshots and switches mode', () => {
    const active = workspaceReducer(init(), { type: 'PROPOSE_SUCCESS', contractId: 'c1' })
    const s = workspaceReducer(active, { type: 'ENTER_WHATIF' })
    expect(s.mode).toBe('whatif')
    expect(s.whatIfOriginal).not.toBeNull()
    expect(s.whatIfOriginal!.legs).toEqual(active.legs)
    expect(s.whatIfOriginal!.dates).toEqual(active.dates)
  })

  test('ENTER_WHATIF from draft is a no-op', () => {
    const s = workspaceReducer(init(), { type: 'ENTER_WHATIF' })
    expect(s.mode).toBe('draft')
    expect(s.whatIfOriginal).toBeNull()
  })

  test('EXIT_WHATIF restores snapshot and returns to active', () => {
    const active = workspaceReducer(init(), { type: 'PROPOSE_SUCCESS', contractId: 'c1' })
    const whatIf = workspaceReducer(active, { type: 'ENTER_WHATIF' })
    const mutated = workspaceReducer(whatIf, {
      type: 'UPDATE_LEG',
      index: 0,
      field: 'notional',
      value: 999,
    })
    const restored = workspaceReducer(mutated, { type: 'EXIT_WHATIF' })
    expect(restored.mode).toBe('active')
    expect(restored.legs).toEqual(active.legs)
    expect(restored.dates).toEqual(active.dates)
    expect(restored.whatIfOriginal).toBeNull()
  })
})

describe('ledger-write results', () => {
  test('PROPOSE_SUCCESS sets active state and proposer role', () => {
    const s = workspaceReducer(init(), { type: 'PROPOSE_SUCCESS', contractId: 'cid' })
    expect(s.mode).toBe('active')
    expect(s.contractId).toBe('cid')
    expect(s.swapStatus).toBe('Proposed')
    expect(s.proposalRole).toBe('proposer')
  })

  test('EXERCISE_SUCCESS accept → Active, role cleared', () => {
    const active = workspaceReducer(init(), { type: 'PROPOSE_SUCCESS', contractId: 'cid' })
    const s = workspaceReducer(active, { type: 'EXERCISE_SUCCESS', choiceKey: 'accept' })
    expect(s.swapStatus).toBe('Active')
    expect(s.proposalRole).toBeNull()
  })

  test('EXERCISE_SUCCESS reject → Terminated', () => {
    const active = workspaceReducer(init(), { type: 'PROPOSE_SUCCESS', contractId: 'cid' })
    const s = workspaceReducer(active, { type: 'EXERCISE_SUCCESS', choiceKey: 'reject' })
    expect(s.swapStatus).toBe('Terminated')
    expect(s.proposalRole).toBeNull()
  })
})
