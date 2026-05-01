import { describe, expect, it } from 'vitest'
import { initialWorkspaceState, workspaceReducer } from '../use-workspace-reducer'

type TestLeg = { legType?: string; notional?: number }

function initIrs() {
  return initialWorkspaceState('draft-irs')
}

function initXccy() {
  return workspaceReducer(initialWorkspaceState('draft-xccy'), {
    type: 'SET_SWAP_TYPE',
    swapType: 'XCCY',
  })
}

describe('notionalLinked defaults', () => {
  it('IRS starts linked', () => {
    expect(initIrs().notionalLinked).toBe(true)
  })

  it('XCCY starts unlinked', () => {
    expect(initXccy().notionalLinked).toBe(false)
  })

  it('SET_SWAP_TYPE to OIS keeps linked', () => {
    const s = workspaceReducer(initIrs(), { type: 'SET_SWAP_TYPE', swapType: 'OIS' })
    expect(s.notionalLinked).toBe(true)
  })

  it('SET_SWAP_TYPE to BASIS keeps linked', () => {
    const s = workspaceReducer(initIrs(), { type: 'SET_SWAP_TYPE', swapType: 'BASIS' })
    expect(s.notionalLinked).toBe(true)
  })

  it('SET_SWAP_TYPE to CDS sets unlinked', () => {
    const s = workspaceReducer(initIrs(), { type: 'SET_SWAP_TYPE', swapType: 'CDS' })
    expect(s.notionalLinked).toBe(false)
  })
})

describe('SET_LEG_NOTIONAL', () => {
  it('syncs both legs when linked', () => {
    const state = initIrs()
    expect(state.notionalLinked).toBe(true)
    const next = workspaceReducer(state, {
      type: 'SET_LEG_NOTIONAL',
      index: 0,
      value: 100_000_000,
    })
    expect((next.legs[0] as TestLeg).notional).toBe(100_000_000)
    expect((next.legs[1] as TestLeg).notional).toBe(100_000_000)
  })

  it('updates only target leg when unlinked', () => {
    const state = initXccy()
    expect(state.notionalLinked).toBe(false)
    const before1 = (state.legs[1] as TestLeg).notional
    const next = workspaceReducer(state, {
      type: 'SET_LEG_NOTIONAL',
      index: 0,
      value: 100_000_000,
    })
    expect((next.legs[0] as TestLeg).notional).toBe(100_000_000)
    expect((next.legs[1] as TestLeg).notional).toBe(before1)
  })

  it('syncs all legs that have a notional field when linked', () => {
    const state = initIrs()
    const next = workspaceReducer(state, {
      type: 'SET_LEG_NOTIONAL',
      index: 1,
      value: 75_000_000,
    })
    expect((next.legs[0] as TestLeg).notional).toBe(75_000_000)
    expect((next.legs[1] as TestLeg).notional).toBe(75_000_000)
  })
})

describe('TOGGLE_NOTIONAL_LINK', () => {
  it('flips the link flag from true to false', () => {
    const state = initIrs()
    const next = workspaceReducer(state, { type: 'TOGGLE_NOTIONAL_LINK' })
    expect(next.notionalLinked).toBe(!state.notionalLinked)
    expect(next.notionalLinked).toBe(false)
  })

  it('flips the link flag from false to true', () => {
    const state = initXccy()
    const next = workspaceReducer(state, { type: 'TOGGLE_NOTIONAL_LINK' })
    expect(next.notionalLinked).toBe(!state.notionalLinked)
    expect(next.notionalLinked).toBe(true)
  })
})
