import { describe, expect, it } from 'vitest'
import type { ContractResult, SwapWorkflow } from '@/shared/ledger/types'
import type { TerminateProposalEntry } from '../hooks/use-terminate-proposals'
import { workflowToRow } from '../page'
import { IRS_INSTR } from './mapper-fixtures'

function wf(cid: string, partyA: string, partyB: string): ContractResult<SwapWorkflow> {
  return {
    contractId: cid,
    payload: {
      partyA,
      partyB,
      swapType: 'IRS',
      notional: '10000000',
      instrumentKey: {
        depository: 'Dep',
        issuer: 'Op',
        id: { unpack: 'IRS-1' },
        version: '0',
        holdingStandard: 'TransferableFungible',
      },
    } as unknown as SwapWorkflow,
  }
}

describe('workflowToRow pendingUnwind join', () => {
  const hint = 'PartyA'

  it('leaves status Active when no proposal matches', () => {
    const row = workflowToRow(
      wf('wf-1', 'PartyA::fp', 'PartyB::fp'),
      hint,
      undefined,
      IRS_INSTR,
      new Map(),
    )
    expect(row.status).toBe('Active')
    expect(row.pendingUnwind).toBeUndefined()
  })

  it('sets UnwindPending with role=proposer when active party proposed', () => {
    const proposals = new Map<string, TerminateProposalEntry>([
      [
        'wf-1',
        {
          proposalCid: 'p-1',
          proposer: 'PartyA::fp',
          counterparty: 'PartyB::fp',
          proposedPvAmount: 100,
        },
      ],
    ])
    const row = workflowToRow(
      wf('wf-1', 'PartyA::fp', 'PartyB::fp'),
      hint,
      undefined,
      IRS_INSTR,
      proposals,
    )
    expect(row.status).toBe('UnwindPending')
    expect(row.pendingUnwind).toEqual({ role: 'proposer', proposalCid: 'p-1' })
  })

  it('sets UnwindPending with role=counterparty when cpty proposed', () => {
    const proposals = new Map<string, TerminateProposalEntry>([
      [
        'wf-1',
        {
          proposalCid: 'p-2',
          proposer: 'PartyB::fp',
          counterparty: 'PartyA::fp',
          proposedPvAmount: -50,
        },
      ],
    ])
    const row = workflowToRow(
      wf('wf-1', 'PartyA::fp', 'PartyB::fp'),
      hint,
      undefined,
      IRS_INSTR,
      proposals,
    )
    expect(row.status).toBe('UnwindPending')
    expect(row.pendingUnwind).toEqual({ role: 'counterparty', proposalCid: 'p-2' })
  })

  it('flips NPV/DV01/sparkline sign for the pay-side viewer (audit E1)', () => {
    // For IRS, getInstrumentDirection returns 'pay' for partyA and
    // 'receive' for partyB. The pricing engine anchors to the 'receive'
    // perspective, so partyA must see the negated engine NPV and partyB
    // must see the raw engine NPV; the two views must be exact mirrors
    // on the same trade — the regulator-of-truth pitch is broken
    // otherwise.
    const valuation = { npv: 1234, dv01: 56, sparkline: [10, 20, 30] }
    const rowA = workflowToRow(
      wf('wf-mirror', 'PartyA::fp', 'PartyB::fp'),
      'PartyA',
      valuation,
      IRS_INSTR,
      new Map(),
    )
    const rowB = workflowToRow(
      wf('wf-mirror', 'PartyA::fp', 'PartyB::fp'),
      'PartyB',
      valuation,
      IRS_INSTR,
      new Map(),
    )
    expect(rowA.direction).toBe('pay')
    expect(rowB.direction).toBe('receive')
    expect(rowA.npv).toBe(-1234)
    expect(rowB.npv).toBe(1234)
    expect(rowA.dv01).toBe(-56)
    expect(rowB.dv01).toBe(56)
    expect(rowA.sparkline).toEqual([-10, -20, -30])
    expect(rowB.sparkline).toEqual([10, 20, 30])
  })

  it('threads tradeDate, legDetail, and maturingSoon onto the row', () => {
    const row = workflowToRow(
      wf('wf-1', 'PartyA::fp', 'PartyB::fp'),
      hint,
      undefined,
      IRS_INSTR,
      new Map(),
    )
    expect(row.tradeDate).toBe('2026-01-01')
    expect(row.legDetail).toBe('Fixed 4% / SOFR/ON')
    // IRS_INSTR matures 2026-04-01 — well outside the 7d window from any
    // realistic test clock (2026-04-27+); maturingSoon must be false.
    expect(row.maturingSoon).toBe(false)
  })
})
