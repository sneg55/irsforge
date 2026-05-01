import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useWorkspaceState } from '../use-workspace-state'

vi.mock('../use-drafts', () => ({
  useDrafts: () => ({
    generateDraftId: () => 'draft-more-1',
    loadDraft: () => null,
  }),
}))

describe('useWorkspaceState additional actions', () => {
  test('updateLeg dispatches UPDATE_LEG', () => {
    const { result } = renderHook(() => useWorkspaceState())
    act(() => {
      result.current.actions.updateLeg(0, 'dayCount', 'Act360')
    })
    // no throw, state present
    expect(result.current.state.legs[0]).toBeTruthy()
  })

  test('setLegNotional updates leg notional', () => {
    const { result } = renderHook(() => useWorkspaceState())
    act(() => {
      result.current.actions.setLegNotional(0, 1_000_000)
    })
    expect(result.current.state.legs[0].notional).toBe(1_000_000)
  })

  test('toggleNotionalLink toggles linked flag', () => {
    const { result } = renderHook(() => useWorkspaceState())
    const before = result.current.state.notionalLinked
    act(() => {
      result.current.actions.toggleNotionalLink()
    })
    expect(result.current.state.notionalLinked).toBe(!before)
  })

  test('updateDateField sets date', () => {
    const { result } = renderHook(() => useWorkspaceState())
    const d = new Date('2030-01-15')
    const before = result.current.state.dates.maturityDate
    act(() => {
      result.current.actions.updateDateField('maturity', d)
    })
    expect(result.current.state.dates.maturityDate).not.toBe(before)
  })

  test('toggleDirection flips direction', () => {
    const { result } = renderHook(() => useWorkspaceState())
    const before = result.current.state.legs[0]?.direction
    act(() => {
      result.current.actions.toggleDirection()
    })
    const after = result.current.state.legs[0]?.direction
    expect(after).not.toBe(before)
  })

  test('setCounterparty updates counterparty', () => {
    const { result } = renderHook(() => useWorkspaceState())
    act(() => {
      result.current.actions.setCounterparty('party-xyz')
    })
    expect(result.current.state.counterparty).toBe('party-xyz')
  })

  test('removeLeg removes leg at index', () => {
    const { result } = renderHook(() => useWorkspaceState())
    act(() => {
      result.current.actions.addLeg()
    })
    const beforeLen = result.current.state.legs.length
    act(() => {
      result.current.actions.removeLeg(beforeLen - 1)
    })
    expect(result.current.state.legs.length).toBe(beforeLen - 1)
  })

  test('setCreditSpread updates credit spread', () => {
    const { result } = renderHook(() => useWorkspaceState())
    act(() => {
      result.current.actions.setSwapType('CDS')
      result.current.actions.setCreditSpread(0.0125)
    })
    expect(result.current.state.creditSpread).toBe(0.0125)
  })
})
