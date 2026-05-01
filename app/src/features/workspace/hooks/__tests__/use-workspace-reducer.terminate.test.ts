import { describe, expect, test } from 'vitest'
import { initialWorkspaceState, workspaceReducer } from '../use-workspace-reducer'

describe('reducer: terminate-awareness', () => {
  test('initial state has pendingUnwind=null, unwindRole=null', () => {
    const s = initialWorkspaceState('draft-1')
    expect(s.pendingUnwind).toBeNull()
    expect(s.unwindRole).toBeNull()
  })

  test('SET_PENDING_UNWIND with value sets both fields', () => {
    const proposal = {
      proposalCid: 'p-1',
      proposer: 'PartyA::ns',
      counterparty: 'PartyB::ns',
      pvAmount: 10_000,
      reason: 'test',
      proposedAt: '2026-04-13T00:00:00Z',
    }
    const s = workspaceReducer(initialWorkspaceState('d'), {
      type: 'SET_PENDING_UNWIND',
      value: { proposal, role: 'proposer' },
    })
    expect(s.pendingUnwind).toEqual(proposal)
    expect(s.unwindRole).toBe('proposer')
  })

  test('SET_PENDING_UNWIND with null clears both fields', () => {
    const start = {
      ...initialWorkspaceState('d'),
      pendingUnwind: {
        proposalCid: 'p',
        proposer: 'A',
        counterparty: 'B',
        pvAmount: 1,
        reason: 'r',
        proposedAt: 't',
      },
      unwindRole: 'proposer' as const,
    }
    const s = workspaceReducer(start, { type: 'SET_PENDING_UNWIND', value: null })
    expect(s.pendingUnwind).toBeNull()
    expect(s.unwindRole).toBeNull()
  })
})
