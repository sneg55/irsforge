'use client'

import { useMemo } from 'react'
import type { SwapConfig } from '../types'
import type { WorkspaceReducerState } from './use-workspace-reducer'

/**
 * Pure function form: given a reducer state, compute the derived values
 * the rest of the workspace hook tree reads. Kept pure so it is trivial
 * to unit-test without rendering.
 */
export function selectWorkspaceDerived(state: WorkspaceReducerState): {
  swapConfig: SwapConfig
  notionalMatch: number | null
} {
  const swapConfig: SwapConfig = {
    type: state.swapType,
    legs: state.legs,
    tradeDate: state.dates.tradeDate,
    effectiveDate: state.dates.effectiveDate,
    maturityDate: state.dates.maturityDate,
    creditSpread: state.creditSpread,
  }
  const firstWithNotional = state.legs.find((l) => 'notional' in l)
  const notionalMatch =
    firstWithNotional && 'notional' in firstWithNotional ? firstWithNotional.notional : null
  return { swapConfig, notionalMatch }
}

/**
 * Hook form: memoizes `swapConfig` + `notionalMatch` on the exact same
 * dependencies the old God-hook used, preserving React-Query key stability.
 */
export function useWorkspaceSelectors(state: WorkspaceReducerState): {
  swapConfig: SwapConfig
  notionalMatch: number | null
} {
  const swapConfig = useMemo<SwapConfig>(
    () => ({
      type: state.swapType,
      legs: state.legs,
      tradeDate: state.dates.tradeDate,
      effectiveDate: state.dates.effectiveDate,
      maturityDate: state.dates.maturityDate,
      creditSpread: state.creditSpread,
    }),
    [
      state.swapType,
      state.legs,
      state.dates.tradeDate,
      state.dates.effectiveDate,
      state.dates.maturityDate,
      state.creditSpread,
    ],
  )

  const notionalMatch = useMemo(() => {
    const first = state.legs.find((l) => 'notional' in l)
    return first && 'notional' in first ? first.notional : null
  }, [state.legs])

  return { swapConfig, notionalMatch }
}
