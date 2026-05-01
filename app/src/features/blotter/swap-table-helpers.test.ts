import { describe, expect, it } from 'vitest'
import { getColumnsForTab } from './constants'
import { sortRows } from './swap-table-helpers'
import type { SwapRow } from './types'

function row(overrides: Partial<SwapRow>): SwapRow {
  return {
    contractId: 'c',
    type: 'IRS',
    counterparty: 'JPMorgan',
    notional: 1_000_000,
    currency: 'USD',
    tradeDate: '2026-01-01',
    maturity: '2027-01-01',
    npv: null,
    dv01: null,
    status: 'Active',
    direction: 'pay',
    ...overrides,
  }
}

const ACTIVE_COLS = getColumnsForTab('active')

describe('sortRows', () => {
  it('returns the input order unchanged when state is null', () => {
    const rows = [row({ contractId: 'a' }), row({ contractId: 'b' })]
    const out = sortRows(rows, null, ACTIVE_COLS)
    expect(out.map((r) => r.contractId)).toEqual(['a', 'b'])
    // Pure: returns a new array, not the same reference.
    expect(out).not.toBe(rows)
  })

  it('sorts numeric columns ascending', () => {
    const rows = [
      row({ contractId: 'a', notional: 30 }),
      row({ contractId: 'b', notional: 10 }),
      row({ contractId: 'c', notional: 20 }),
    ]
    const out = sortRows(rows, { key: 'notional', dir: 'asc' }, ACTIVE_COLS)
    expect(out.map((r) => r.contractId)).toEqual(['b', 'c', 'a'])
  })

  it('sorts numeric columns descending', () => {
    const rows = [
      row({ contractId: 'a', notional: 30 }),
      row({ contractId: 'b', notional: 10 }),
      row({ contractId: 'c', notional: 20 }),
    ]
    const out = sortRows(rows, { key: 'notional', dir: 'desc' }, ACTIVE_COLS)
    expect(out.map((r) => r.contractId)).toEqual(['a', 'c', 'b'])
  })

  it('sorts string columns lexically', () => {
    const rows = [
      row({ contractId: 'a', counterparty: 'Citi' }),
      row({ contractId: 'b', counterparty: 'Barclays' }),
      row({ contractId: 'c', counterparty: 'JPMorgan' }),
    ]
    const out = sortRows(rows, { key: 'counterparty', dir: 'asc' }, ACTIVE_COLS)
    expect(out.map((r) => r.contractId)).toEqual(['b', 'a', 'c'])
  })

  it('pushes null/undefined accessor values to the end regardless of direction', () => {
    const rows = [
      row({ contractId: 'a', npv: null }),
      row({ contractId: 'b', npv: 100 }),
      row({ contractId: 'c', npv: 50 }),
    ]
    const asc = sortRows(rows, { key: 'npv', dir: 'asc' }, ACTIVE_COLS)
    expect(asc.map((r) => r.contractId)).toEqual(['c', 'b', 'a'])
    const desc = sortRows(rows, { key: 'npv', dir: 'desc' }, ACTIVE_COLS)
    expect(desc.map((r) => r.contractId)).toEqual(['b', 'c', 'a'])
  })

  it('returns input order when sorting by an unsortable column', () => {
    // sparkline column has no sortAccessor.
    const rows = [row({ contractId: 'a' }), row({ contractId: 'b' })]
    const out = sortRows(rows, { key: 'sparkline', dir: 'asc' }, ACTIVE_COLS)
    expect(out.map((r) => r.contractId)).toEqual(['a', 'b'])
  })
})
