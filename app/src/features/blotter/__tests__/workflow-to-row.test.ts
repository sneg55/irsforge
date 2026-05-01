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
