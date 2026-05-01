import { describe, expect, test } from 'vitest'
import { initialWorkspaceState } from '../use-workspace-reducer'
import { selectWorkspaceDerived } from '../use-workspace-selectors'

describe('selectWorkspaceDerived', () => {
  test('swapConfig reflects state.swapType, legs, and dates', () => {
    const state = initialWorkspaceState('draft-1')
    const { swapConfig } = selectWorkspaceDerived(state)
    expect(swapConfig.type).toBe(state.swapType)
    expect(swapConfig.legs).toBe(state.legs)
    expect(swapConfig.tradeDate).toBe(state.dates.tradeDate)
    expect(swapConfig.effectiveDate).toBe(state.dates.effectiveDate)
    expect(swapConfig.maturityDate).toBe(state.dates.maturityDate)
  })

  test('notionalMatch returns first leg notional when present', () => {
    const state = initialWorkspaceState('draft-1')
    // Default IRS config has two legs, first fixed with notional 50_000_000.
    const { notionalMatch } = selectWorkspaceDerived(state)
    expect(notionalMatch).toBe(50_000_000)
  })

  test('notionalMatch returns null when no leg has notional field', () => {
    const state = initialWorkspaceState('draft-1')
    const stateNoNotional = { ...state, legs: [] }
    const { notionalMatch } = selectWorkspaceDerived(stateNoNotional)
    expect(notionalMatch).toBeNull()
  })
})
