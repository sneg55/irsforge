/**
 * Tests for the row-building functions in mappers.ts:
 * maturedToRow, terminatedToRow.
 */
import { describe, expect, it } from 'vitest'
import { maturedToRow, terminatedToRow } from '../mappers'
import { CCY_INSTR, IRS_INSTR, maturedContract, terminatedContract } from './mapper-fixtures'

describe('maturedToRow', () => {
  it('maps a MaturedSwap for partyA', () => {
    const row = maturedToRow(maturedContract(), 'PartyA', IRS_INSTR)
    expect(row).toMatchObject({
      contractId: 'cid-matured-1',
      type: 'IRS',
      counterparty: 'PartyB',
      notional: 10_000_000,
      currency: 'USD',
      maturity: '2026-04-01',
      status: 'Matured',
      direction: 'pay',
      npv: null,
      dv01: null,
      terminalDate: '2026-04-02',
      terminalAmount: 12345.67,
      settleBatchCid: 'batch-cid-1',
    })
  })

  it('flips counterparty and direction for partyB', () => {
    const row = maturedToRow(maturedContract(), 'PartyB', IRS_INSTR)
    expect(row.counterparty).toBe('PartyA')
    expect(row.direction).toBe('receive')
  })

  it('derives currency from CCY instrument baseCurrency', () => {
    const row = maturedToRow(maturedContract({ swapType: 'CCY' }), 'PartyA', CCY_INSTR)
    expect(row.currency).toBe('EUR')
  })

  it('preserves negative finalNetAmount sign', () => {
    const row = maturedToRow(maturedContract({ finalNetAmount: '-42.5' }), 'PartyA', IRS_INSTR)
    expect(row.terminalAmount).toBe(-42.5)
  })

  it('passes through null finalSettleBatchCid', () => {
    const row = maturedToRow(maturedContract({ finalSettleBatchCid: null }), 'PartyA', IRS_INSTR)
    expect(row.settleBatchCid).toBeNull()
  })

  it('uses loading placeholders when instrument is undefined', () => {
    const row = maturedToRow(maturedContract(), 'PartyA', undefined)
    expect(row.currency).toBe('USD')
    expect(row.direction).toBe('pay')
    expect(row.maturity).toBe('—')
  })
})

describe('terminatedToRow', () => {
  it('maps a TerminatedSwap for partyA', () => {
    const row = terminatedToRow(terminatedContract(), 'PartyA', IRS_INSTR)
    expect(row).toMatchObject({
      contractId: 'cid-term-1',
      type: 'IRS',
      counterparty: 'PartyB',
      notional: 5_000_000,
      currency: 'USD',
      maturity: '2026-04-01',
      status: 'Unwound',
      direction: 'pay',
      npv: null,
      dv01: null,
      terminalDate: '2026-04-13',
      terminalAmount: -98765.43,
      reason: 'Counterparty unwind',
      terminatedByParty: 'PartyB',
      settleBatchCid: 'batch-cid-2',
    })
  })

  it('flips counterparty and direction for partyB', () => {
    const row = terminatedToRow(terminatedContract(), 'PartyB', IRS_INSTR)
    expect(row.counterparty).toBe('PartyA')
    expect(row.direction).toBe('receive')
  })

  it('passes through null settleBatchCid for zero-PV termination', () => {
    const row = terminatedToRow(
      terminatedContract({ settleBatchCid: null, agreedPvAmount: '0' }),
      'PartyA',
      IRS_INSTR,
    )
    expect(row.settleBatchCid).toBeNull()
    expect(row.terminalAmount).toBe(0)
  })
})
