import { describe, expect, it } from 'vitest'
import { rowsToCsv } from './to-csv'
import type { SwapRow } from './types'

const baseRow: SwapRow = {
  contractId: 'c1',
  type: 'IRS',
  counterparty: 'JPMorgan',
  notional: 10_000_000,
  currency: 'USD',
  tradeDate: '2026-01-01',
  maturity: '2027-01-01',
  npv: 12_345,
  dv01: 250,
  status: 'Active',
  direction: 'pay',
  legDetail: 'Fixed 4.25% / SOFR',
}

describe('rowsToCsv', () => {
  it('emits a header row plus one data row per input', () => {
    const csv = rowsToCsv([baseRow])
    const lines = csv.trimEnd().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(
      'contractId,type,status,counterparty,notional,currency,tradeDate,maturity,npv,dv01,direction,legDetail',
    )
    expect(lines[1]).toBe(
      'c1,IRS,Active,JPMorgan,10000000,USD,2026-01-01,2027-01-01,12345,250,pay,Fixed 4.25% / SOFR',
    )
  })

  it('escapes commas and quotes per RFC 4180', () => {
    const csv = rowsToCsv([
      {
        ...baseRow,
        counterparty: 'Smith, Jr.',
        legDetail: 'Fixed "5%" / SOFR',
      },
    ])
    expect(csv).toContain('"Smith, Jr."')
    expect(csv).toContain('"Fixed ""5%"" / SOFR"')
  })

  it('renders nullable cells (npv, dv01, legDetail) as empty fields', () => {
    const csv = rowsToCsv([{ ...baseRow, npv: null, dv01: null, legDetail: undefined }])
    const cells = csv.trimEnd().split('\n')[1]?.split(',') ?? []
    // Indices: contractId(0) type(1) status(2) cpty(3) notional(4) ccy(5)
    //          tradeDate(6) maturity(7) npv(8) dv01(9) direction(10) legDetail(11)
    expect(cells[8]).toBe('')
    expect(cells[9]).toBe('')
    expect(cells[11]).toBe('')
  })

  it('header-only output for an empty rows array', () => {
    const csv = rowsToCsv([])
    expect(csv.trimEnd().split('\n')).toHaveLength(1)
  })
})
