import { describe, expect, test } from 'vitest'
import { initialWorkspaceState, workspaceReducer } from '../use-workspace-reducer'

// Regression: FieldGrid commits every edit as a string. The pricing engine
// sums spreads/rates/notionals via `+`, which concatenates strings and
// yields NaN unless the reducer coerces numeric-looking strings to numbers.
// Non-numeric fields (currency codes, indexIds) must stay as strings.
describe('UPDATE_LEG — numeric coercion', () => {
  test('coerces numeric-looking string spread to number', () => {
    const s = workspaceReducer(initialWorkspaceState('d'), {
      type: 'UPDATE_LEG',
      index: 1,
      field: 'spread',
      value: '0.01',
    })
    expect((s.legs[1] as unknown as { spread: number }).spread).toBe(0.01)
  })

  test('coerces integer-looking string notional to number', () => {
    const s = workspaceReducer(initialWorkspaceState('d'), {
      type: 'UPDATE_LEG',
      index: 0,
      field: 'notional',
      value: '75000000',
    })
    expect((s.legs[0] as unknown as { notional: number }).notional).toBe(75_000_000)
  })

  test('leaves non-numeric string fields (currency) as strings', () => {
    const s = workspaceReducer(initialWorkspaceState('d'), {
      type: 'UPDATE_LEG',
      index: 0,
      field: 'currency',
      value: 'EUR',
    })
    expect((s.legs[0] as unknown as { currency: string }).currency).toBe('EUR')
  })

  test('leaves indexId as string even though it contains digits', () => {
    const s = workspaceReducer(initialWorkspaceState('d'), {
      type: 'UPDATE_LEG',
      index: 1,
      field: 'indexId',
      value: 'SOFR/3M',
    })
    expect((s.legs[1] as unknown as { indexId: string }).indexId).toBe('SOFR/3M')
  })
})
