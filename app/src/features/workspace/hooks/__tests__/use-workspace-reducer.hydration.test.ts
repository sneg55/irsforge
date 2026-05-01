import { describe, expect, test } from 'vitest'
import { SWAP_TYPE_CONFIGS } from '../../constants'
import type { SwapConfig } from '../../types'
import { initialWorkspaceState, workspaceReducer } from '../use-workspace-reducer'

function init() {
  return initialWorkspaceState('draft-123')
}

describe('hydration', () => {
  test('HYDRATE_FROM_SWAP sets active+Proposed', () => {
    const s = workspaceReducer(init(), { type: 'HYDRATE_FROM_SWAP', contractId: 'cid-42' })
    expect(s.mode).toBe('active')
    expect(s.swapStatus).toBe('Proposed')
    expect(s.contractId).toBe('cid-42')
  })

  test('HYDRATE_FROM_DRAFT applies config fields and recomputes tenor', () => {
    const trade = new Date('2026-04-01')
    const eff = new Date('2026-04-03')
    const mat = new Date('2028-04-03')
    const config: SwapConfig = {
      type: 'CDS',
      legs: SWAP_TYPE_CONFIGS.CDS.defaultLegs.map((l) => ({ ...l })),
      tradeDate: trade,
      effectiveDate: eff,
      maturityDate: mat,
    }
    const s = workspaceReducer(init(), { type: 'HYDRATE_FROM_DRAFT', draftId: 'd-1', config })
    expect(s.draftId).toBe('d-1')
    expect(s.swapType).toBe('CDS')
    expect(s.dates.tradeDate).toEqual(trade)
    expect(s.dates.effectiveDate).toEqual(eff)
    expect(s.dates.maturityDate).toEqual(mat)
    expect(s.dates.anchor).toBe('tenor')
    expect(s.dates.effManuallySet).toBe(true) // eff != trade
  })

  test('HYDRATE_FROM_DRAFT back-fills missing direction for IRS', () => {
    const legacyConfig = {
      type: 'IRS' as const,
      tradeDate: new Date('2026-04-21'),
      effectiveDate: new Date('2026-04-21'),
      maturityDate: new Date('2031-04-21'),
      legs: [
        // pre-Phase-A shape: no direction
        {
          legType: 'fixed',
          currency: 'USD',
          notional: 1_000_000,
          rate: 0.04,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date('2026-04-21'),
            endDate: new Date('2031-04-21'),
            frequency: 'Quarterly',
          },
        },
        {
          legType: 'float',
          currency: 'USD',
          notional: 1_000_000,
          indexId: 'USD-SOFR',
          spread: 0,
          dayCount: 'ACT_360',
          schedule: {
            startDate: new Date('2026-04-21'),
            endDate: new Date('2031-04-21'),
            frequency: 'Quarterly',
          },
        },
      ],
    } as any
    const state = workspaceReducer(init(), {
      type: 'HYDRATE_FROM_DRAFT',
      draftId: 'd1',
      config: legacyConfig,
    })
    expect(state.legs[0].direction).toBe('receive')
    expect(state.legs[1].direction).toBe('pay')
  })
})

describe('RESOLVE_PROPOSAL', () => {
  test('sets swapType, role, counterparty', () => {
    const withCid = workspaceReducer(init(), { type: 'HYDRATE_FROM_SWAP', contractId: 'cid' })
    const s = workspaceReducer(withCid, {
      type: 'RESOLVE_PROPOSAL',
      swapType: 'CCY',
      role: 'counterparty',
      counterparty: 'PartyA',
    })
    expect(s.swapType).toBe('CCY')
    expect(s.proposalRole).toBe('counterparty')
    expect(s.counterparty).toBe('PartyA')
  })
})

describe('reducer: settlement-awareness', () => {
  test('initial state has null workflow party fields and 0 outstanding effects', () => {
    const s = initialWorkspaceState('draft-1')
    expect(s.workflowPartyA).toBeNull()
    expect(s.workflowPartyB).toBeNull()
    expect(s.outstandingEffectsCount).toBe(0)
  })

  test('SET_WORKFLOW_PARTIES sets both party hints', () => {
    const s = workspaceReducer(initialWorkspaceState('d'), {
      type: 'SET_WORKFLOW_PARTIES',
      partyA: 'PartyA::ns',
      partyB: 'PartyB::ns',
    })
    expect(s.workflowPartyA).toBe('PartyA::ns')
    expect(s.workflowPartyB).toBe('PartyB::ns')
  })

  test('SET_OUTSTANDING_EFFECTS sets the count', () => {
    const s = workspaceReducer(initialWorkspaceState('d'), {
      type: 'SET_OUTSTANDING_EFFECTS',
      count: 3,
    })
    expect(s.outstandingEffectsCount).toBe(3)
  })
})

describe('SET_COUNTERPARTY', () => {
  test('updates counterparty string', () => {
    const s = workspaceReducer(init(), { type: 'SET_COUNTERPARTY', party: 'PartyZ' })
    expect(s.counterparty).toBe('PartyZ')
  })
})

describe('SET_DRAFT_ID', () => {
  test('changes draftId and leaves all other fields unchanged', () => {
    const base = init()
    const s = workspaceReducer(base, { type: 'SET_DRAFT_ID', draftId: 'url-draft-abc' })
    expect(s.draftId).toBe('url-draft-abc')
    expect(s.mode).toBe(base.mode)
    expect(s.swapType).toBe(base.swapType)
    expect(s.legs).toEqual(base.legs)
    expect(s.dates).toEqual(base.dates)
    expect(s.counterparty).toBe(base.counterparty)
    expect(s.contractId).toBe(base.contractId)
    expect(s.swapStatus).toBe(base.swapStatus)
    expect(s.proposalRole).toBe(base.proposalRole)
    expect(s.whatIfOriginal).toBe(base.whatIfOriginal)
  })
})

describe('reducer: active-phase contract ids', () => {
  test('initial state has null workflow id', () => {
    const s = init()
    expect(s.workflowContractId).toBeNull()
  })

  test('SET_WORKFLOW_CONTRACT sets id', () => {
    const s = workspaceReducer(init(), { type: 'SET_WORKFLOW_CONTRACT', contractId: 'wf-1' })
    expect(s.workflowContractId).toBe('wf-1')
  })

  test('EXERCISE_SUCCESS(accept) captures workflow contractId', () => {
    const proposed = workspaceReducer(init(), { type: 'PROPOSE_SUCCESS', contractId: 'p-1' })
    const active = workspaceReducer(proposed, {
      type: 'EXERCISE_SUCCESS',
      choiceKey: 'accept',
      workflowContractId: 'wf-2',
    })
    expect(active.swapStatus).toBe('Active')
    expect(active.workflowContractId).toBe('wf-2')
  })

  test('EXERCISE_SUCCESS(reject) leaves workflow id null', () => {
    const proposed = workspaceReducer(init(), { type: 'PROPOSE_SUCCESS', contractId: 'p-1' })
    const terminated = workspaceReducer(proposed, { type: 'EXERCISE_SUCCESS', choiceKey: 'reject' })
    expect(terminated.swapStatus).toBe('Terminated')
    expect(terminated.workflowContractId).toBeNull()
  })
})
