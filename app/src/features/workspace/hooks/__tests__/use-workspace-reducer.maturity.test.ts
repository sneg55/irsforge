import { describe, expect, test } from 'vitest'
import { initialWorkspaceState, workspaceReducer } from '../use-workspace-reducer'

describe('reducer: maturity-awareness', () => {
  test('initial state has isPastMaturity = false', () => {
    const s = initialWorkspaceState('draft-1')
    expect(s.isPastMaturity).toBe(false)
  })

  test('SET_IS_PAST_MATURITY updates the flag', () => {
    const s = workspaceReducer(initialWorkspaceState('d'), {
      type: 'SET_IS_PAST_MATURITY',
      value: true,
    })
    expect(s.isPastMaturity).toBe(true)
  })
})
