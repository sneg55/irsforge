'use client'

import type { Dispatch } from 'react'
import { useCallback, useMemo, useReducer } from 'react'
import type { SwapType } from '../types'
import type { DateAnchor } from '../utils/date-recalc'
import type { Tenor } from '../utils/tenor-parser'
import { useDrafts } from './use-drafts'
import type { Action, WorkspaceReducerState } from './use-workspace-reducer'
import { initialWorkspaceState, workspaceReducer } from './use-workspace-reducer'

export interface WorkspaceActions {
  setSwapType: (type: SwapType) => void
  updateLeg: (index: number, field: string, value: unknown) => void
  setLegNotional: (index: number, value: number) => void
  toggleNotionalLink: () => void
  updateDateField: (field: DateAnchor, value: Date | Tenor) => void
  toggleDirection: () => void
  toggleWhatIf: () => void
  setCounterparty: (party: string) => void
  addLeg: () => void
  removeLeg: (index: number) => void
  setCreditSpread: (value: number) => void
}

/**
 * Owns the workspace reducer, plus a set of pre-bound dispatch wrappers
 * that the composer and UI consume. No ledger IO, no selectors, no effects.
 */
export function useWorkspaceState(): {
  state: WorkspaceReducerState
  dispatch: Dispatch<Action>
  actions: WorkspaceActions
} {
  const { generateDraftId } = useDrafts()
  const initialDraftId = useMemo(() => generateDraftId(), [generateDraftId])
  const [state, dispatch] = useReducer(workspaceReducer, initialDraftId, initialWorkspaceState)

  const setSwapType = useCallback(
    (type: SwapType) => dispatch({ type: 'SET_SWAP_TYPE', swapType: type }),
    [],
  )
  const updateLeg = useCallback(
    (index: number, field: string, value: unknown) =>
      dispatch({ type: 'UPDATE_LEG', index, field, value }),
    [],
  )
  const setLegNotional = useCallback(
    (index: number, value: number) => dispatch({ type: 'SET_LEG_NOTIONAL', index, value }),
    [],
  )
  const toggleNotionalLink = useCallback(() => dispatch({ type: 'TOGGLE_NOTIONAL_LINK' }), [])
  const updateDateField = useCallback(
    (field: DateAnchor, value: Date | Tenor) =>
      dispatch({ type: 'SET_DATES', anchor: field, value }),
    [],
  )
  const toggleDirection = useCallback(() => dispatch({ type: 'TOGGLE_DIRECTION' }), [])
  const setCounterparty = useCallback(
    (party: string) => dispatch({ type: 'SET_COUNTERPARTY', party }),
    [],
  )
  const addLeg = useCallback(() => dispatch({ type: 'ADD_LEG' }), [])
  const removeLeg = useCallback((index: number) => dispatch({ type: 'REMOVE_LEG', index }), [])
  const setCreditSpread = useCallback(
    (value: number) => dispatch({ type: 'SET_CREDIT_SPREAD', value }),
    [],
  )
  const toggleWhatIf = useCallback(() => {
    if (state.mode === 'active') dispatch({ type: 'ENTER_WHATIF' })
    else if (state.mode === 'whatif') dispatch({ type: 'EXIT_WHATIF' })
  }, [state.mode])

  const actions = useMemo<WorkspaceActions>(
    () => ({
      setSwapType,
      updateLeg,
      setLegNotional,
      toggleNotionalLink,
      updateDateField,
      toggleDirection,
      toggleWhatIf,
      setCounterparty,
      addLeg,
      removeLeg,
      setCreditSpread,
    }),
    [
      setSwapType,
      updateLeg,
      setLegNotional,
      toggleNotionalLink,
      updateDateField,
      toggleDirection,
      toggleWhatIf,
      setCounterparty,
      addLeg,
      removeLeg,
      setCreditSpread,
    ],
  )

  return { state, dispatch, actions }
}
