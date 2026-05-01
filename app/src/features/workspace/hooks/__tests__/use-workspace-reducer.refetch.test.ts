import { describe, expect, test } from 'vitest'
import { initialWorkspaceState, workspaceReducer } from '../use-workspace-reducer'

// Kept separate from `use-workspace-reducer.test.ts` to stay under the 300-
// line file-size guard. The nonce is a pure invalidation signal for
// useActiveContracts' useEffect deps — never decrements, never resets.
// Any ledger-mutating action (workflow choice, margin, terminate proposal)
// dispatches REFETCH_ACTIVE_CONTRACTS so the right-panel re-queries.
describe('REFETCH_ACTIVE_CONTRACTS', () => {
  test('initial nonce is 0', () => {
    const s = initialWorkspaceState('d')
    expect(s.activeContractsRefetchNonce).toBe(0)
  })

  test('monotonically bumps the nonce and leaves other state untouched', () => {
    let s = initialWorkspaceState('d')
    const baseline = { ...s }
    s = workspaceReducer(s, { type: 'REFETCH_ACTIVE_CONTRACTS' })
    expect(s.activeContractsRefetchNonce).toBe(1)
    s = workspaceReducer(s, { type: 'REFETCH_ACTIVE_CONTRACTS' })
    s = workspaceReducer(s, { type: 'REFETCH_ACTIVE_CONTRACTS' })
    expect(s.activeContractsRefetchNonce).toBe(3)
    // Everything except the nonce is unchanged.
    expect(s.mode).toBe(baseline.mode)
    expect(s.swapType).toBe(baseline.swapType)
    expect(s.contractId).toBe(baseline.contractId)
    expect(s.swapStatus).toBe(baseline.swapStatus)
    expect(s.outstandingEffectsCount).toBe(baseline.outstandingEffectsCount)
  })
})
