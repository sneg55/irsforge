import { describe, expect, it } from 'vitest'
import type { SwapWorkflow } from '../../../shared/types.js'
import { groupByNettingSet } from '../netting-set.js'

const csa = (cid: string, a: string, b: string) => ({
  contractId: cid,
  payload: { partyA: a, partyB: b },
})

const wf = (cid: string, a: string, b: string) => ({
  contractId: cid,
  payload: {
    swapType: 'IRS',
    operator: 'Op',
    partyA: a,
    partyB: b,
    regulators: ['Reg'],
    scheduler: 'Sched',
    instrumentKey: {
      depository: 'D',
      issuer: 'I',
      id: { unpack: 'inst' },
      version: '1',
      holdingStandard: 'TransferableFungible',
    },
    notional: '1000000',
  } satisfies SwapWorkflow,
})

describe('groupByNettingSet', () => {
  it('matches both orderings of (partyA, partyB)', () => {
    const out = groupByNettingSet(
      [csa('c1', 'PA', 'PB')],
      [wf('w1', 'PA', 'PB'), wf('w2', 'PB', 'PA'), wf('w3', 'PA', 'PC')],
    )
    expect(out).toHaveLength(1)
    expect(out[0].swaps.map((s) => s.contractId)).toEqual(['w1', 'w2'])
  })

  it('returns CSA with empty swaps when none match', () => {
    const out = groupByNettingSet([csa('c1', 'PA', 'PB')], [wf('w1', 'PA', 'PC')])
    expect(out[0].swaps).toEqual([])
  })
})
