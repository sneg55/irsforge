import { describe, expect, it } from 'vitest'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import type {
  ContractResult,
  MaturedSwap,
  SwapWorkflow,
  TerminatedSwap,
} from '@/shared/ledger/types'
import type { CrossOrgProposalRow } from '../../hooks/use-all-proposals-cross-org'
import { maturedToRow, proposalToRow, terminatedToRow, workflowToRow } from '../workflow-to-row'

const INSTRUMENT_KEY = {
  id: { unpack: 'I1' },
  version: '1',
  depository: 'D',
  issuer: 'I',
  holdingStandard: 'TF',
}

function mkIrsInstrument(effectiveDate: string): SwapInstrumentPayload {
  return {
    swapType: 'IRS',
    payload: {
      ...INSTRUMENT_KEY,
      description: '',
      floatingRate: { referenceRateId: 'USD-SOFR' },
      ownerReceivesFix: true,
      fixRate: '0.04',
      periodicSchedule: {
        effectiveDate,
        terminationDate: '2029-01-01',
        firstRegularPeriodStartDate: null,
        lastRegularPeriodEndDate: null,
      },
      dayCountConvention: 'Act360',
      currency: { ...INSTRUMENT_KEY, id: { unpack: 'USD' } },
    },
  }
}

function mkWorkflow(): ContractResult<SwapWorkflow> {
  return {
    contractId: 'wf1',
    payload: {
      swapType: 'IRS',
      partyA: 'A',
      partyB: 'B',
      operator: 'Op',
      regulators: ['Reg'],
      scheduler: 'Sch',
      instrumentKey: INSTRUMENT_KEY,
      notional: '100',
    },
  }
}

describe('workflowToRow', () => {
  it('populates sortDateMs from the instrument effective date', () => {
    const byId = new Map<string, SwapInstrumentPayload>([['I1', mkIrsInstrument('2027-06-15')]])
    const row = workflowToRow(mkWorkflow(), byId)
    expect(row.status).toBe('Live')
    expect(row.sortDateMs).toBe(Date.parse('2027-06-15'))
  })

  it('returns sortDateMs=null when the instrument has not resolved yet', () => {
    const row = workflowToRow(mkWorkflow(), new Map())
    expect(row.sortDateMs).toBe(null)
  })
})

describe('maturedToRow', () => {
  it('sorts on actualMaturityDate, not the instrument effective date', () => {
    const c: ContractResult<MaturedSwap> = {
      contractId: 'mat1',
      payload: {
        operator: 'Op',
        partyA: 'A',
        partyB: 'B',
        regulators: ['Reg'],
        scheduler: 'Sch',
        swapType: 'IRS',
        instrumentKey: INSTRUMENT_KEY,
        notional: '100',
        actualMaturityDate: '2028-12-31',
        finalSettleBatchCid: null,
        finalNetAmount: '0',
      },
    }
    const row = maturedToRow(c, new Map([['I1', mkIrsInstrument('2025-01-01')]]))
    expect(row.status).toBe('Matured')
    expect(row.sortDateMs).toBe(Date.parse('2028-12-31'))
  })
})

describe('terminatedToRow', () => {
  it('sorts on terminationDate', () => {
    const c: ContractResult<TerminatedSwap> = {
      contractId: 'term1',
      payload: {
        operator: 'Op',
        partyA: 'A',
        partyB: 'B',
        regulators: ['Reg'],
        swapType: 'IRS',
        instrumentKey: INSTRUMENT_KEY,
        notional: '100',
        terminationDate: '2026-03-14',
        agreedPvAmount: '0',
        reason: 'Mutual',
        terminatedByParty: 'A',
        settleBatchCid: null,
      },
    }
    const row = terminatedToRow(c, new Map())
    expect(row.status).toBe('Terminated')
    expect(row.sortDateMs).toBe(Date.parse('2026-03-14'))
  })
})

describe('proposalToRow', () => {
  it('sorts on proposal startDate', () => {
    const p: CrossOrgProposalRow = {
      family: 'IRS',
      contractId: 'p1',
      proposer: 'A',
      counterparty: 'B',
      payload: { notional: '100', startDate: '2027-09-01' },
    }
    const row = proposalToRow(p)
    expect(row.status).toBe('Proposed')
    expect(row.sortDateMs).toBe(Date.parse('2027-09-01'))
  })

  it('falls back to firstPaymentDate for FX proposals', () => {
    const p: CrossOrgProposalRow = {
      family: 'FX',
      contractId: 'p2',
      proposer: 'A',
      counterparty: 'B',
      payload: { notional: '100', firstPaymentDate: '2027-02-14' },
    }
    const row = proposalToRow(p)
    expect(row.sortDateMs).toBe(Date.parse('2027-02-14'))
  })

  it('returns sortDateMs=null when no date field is present', () => {
    const p: CrossOrgProposalRow = {
      family: 'IRS',
      contractId: 'p3',
      proposer: 'A',
      counterparty: 'B',
      payload: { notional: '100' },
    }
    expect(proposalToRow(p).sortDateMs).toBe(null)
  })
})
