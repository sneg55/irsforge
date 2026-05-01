import { renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { initialWorkspaceState } from '../use-workspace-reducer'
import { selectWorkspaceDerived, useWorkspaceSelectors } from '../use-workspace-selectors'

describe('useWorkspaceSelectors (hook form)', () => {
  test('returns swapConfig and notionalMatch', () => {
    const state = initialWorkspaceState('d-1')
    const { result } = renderHook(() => useWorkspaceSelectors(state))
    expect(result.current.swapConfig.type).toBe(state.swapType)
    expect(result.current.swapConfig.legs).toBe(state.legs)
    expect(result.current.notionalMatch).toBe(50_000_000)
  })

  test('memoizes identity across rerender with same state', () => {
    const state = initialWorkspaceState('d-1')
    const { result, rerender } = renderHook(({ s }) => useWorkspaceSelectors(s), {
      initialProps: { s: state },
    })
    const firstCfg = result.current.swapConfig
    rerender({ s: state })
    expect(result.current.swapConfig).toBe(firstCfg)
  })

  test('selectWorkspaceDerived: credit spread propagates to swapConfig', () => {
    const state = { ...initialWorkspaceState('d-2'), creditSpread: 0.01 }
    const { swapConfig } = selectWorkspaceDerived(state)
    expect(swapConfig.creditSpread).toBe(0.01)
  })

  test('hook form: notionalMatch is null when legs is empty', () => {
    const state = { ...initialWorkspaceState('d-3'), legs: [] }
    const { result } = renderHook(() => useWorkspaceSelectors(state))
    expect(result.current.notionalMatch).toBeNull()
  })
})
