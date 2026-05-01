import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useWorkspaceState } from '../use-workspace-state'

vi.mock('../use-drafts', () => ({
  useDrafts: () => ({
    generateDraftId: () => 'draft-fixed-1',
    loadDraft: () => null,
  }),
}))

describe('useWorkspaceState', () => {
  test('state initializes with the generated draft id', () => {
    const { result } = renderHook(() => useWorkspaceState())
    expect(result.current.state.draftId).toBe('draft-fixed-1')
    expect(result.current.state.mode).toBe('draft')
    expect(result.current.state.swapType).toBe('IRS')
  })

  test('actions.setSwapType dispatches SET_SWAP_TYPE', () => {
    const { result } = renderHook(() => useWorkspaceState())
    act(() => {
      result.current.actions.setSwapType('CDS')
    })
    expect(result.current.state.swapType).toBe('CDS')
  })

  test('actions.addLeg appends a leg', () => {
    const { result } = renderHook(() => useWorkspaceState())
    const initial = result.current.state.legs.length
    act(() => {
      result.current.actions.addLeg()
    })
    expect(result.current.state.legs.length).toBe(initial + 1)
  })

  test('actions.toggleWhatIf dispatches ENTER_WHATIF only from active mode', () => {
    const { result } = renderHook(() => useWorkspaceState())
    // Default mode is 'draft' — toggleWhatIf should be a no-op.
    act(() => {
      result.current.actions.toggleWhatIf()
    })
    expect(result.current.state.mode).toBe('draft')
    // Transition to active via PROPOSE_SUCCESS, then toggle.
    act(() => {
      result.current.dispatch({ type: 'PROPOSE_SUCCESS', contractId: 'p-1' })
    })
    expect(result.current.state.mode).toBe('active')
    act(() => {
      result.current.actions.toggleWhatIf()
    })
    expect(result.current.state.mode).toBe('whatif')
    // Toggle again → exits what-if.
    act(() => {
      result.current.actions.toggleWhatIf()
    })
    expect(result.current.state.mode).toBe('active')
  })

  test('dispatch identity is stable across renders', () => {
    const { result, rerender } = renderHook(() => useWorkspaceState())
    const first = result.current.dispatch
    rerender()
    expect(result.current.dispatch).toBe(first)
  })
})
