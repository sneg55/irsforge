import { describe, expect, test } from 'vitest'
import { computeSummary, EMPTY_CSA_SUMMARY } from './compute-summary'
import type { SwapRow } from './types'

function row(overrides: Partial<SwapRow> & Pick<SwapRow, 'notional' | 'direction'>): SwapRow {
  return {
    contractId: 'c',
    type: 'IRS',
    counterparty: 'PartyB',
    currency: 'USD',
    maturity: '2027-01-01',
    npv: null,
    dv01: null,
    status: 'Active',
    ...overrides,
  }
}

describe('computeSummary', () => {
  test('totalNotional and netExposure reflect only active swaps, not proposals', () => {
    const active: SwapRow[] = [
      row({ notional: 10_000_000, direction: 'pay' }),
      row({ notional: 25_000_000, direction: 'receive' }),
    ]
    const proposals: SwapRow[] = [
      row({ notional: 50_000_000, direction: 'pay' }),
      row({ notional: 5_000_000, direction: 'receive' }),
    ]

    const summary = computeSummary(active, proposals, EMPTY_CSA_SUMMARY)

    expect(summary.totalNotional).toBe(35_000_000)
    expect(summary.netExposure).toBe(15_000_000)
    expect(summary.activeSwaps).toBe(2)
    expect(summary.pendingProposals).toBe(2)
  })

  test('with zero active swaps, exposure is zero regardless of proposal count', () => {
    const active: SwapRow[] = []
    const proposals: SwapRow[] = [
      row({ notional: 50_000_000, direction: 'receive' }),
      row({ notional: 30_000_000, direction: 'receive' }),
    ]

    const summary = computeSummary(active, proposals, EMPTY_CSA_SUMMARY)

    expect(summary.activeSwaps).toBe(0)
    expect(summary.totalNotional).toBe(0)
    expect(summary.netExposure).toBe(0)
    expect(summary.pendingProposals).toBe(2)
  })

  test('swapCountByType counts only active swaps', () => {
    const active: SwapRow[] = [
      row({ notional: 1, direction: 'pay', type: 'IRS' }),
      row({ notional: 1, direction: 'pay', type: 'IRS' }),
      row({ notional: 1, direction: 'pay', type: 'CDS' }),
    ]
    const proposals: SwapRow[] = [row({ notional: 1, direction: 'pay', type: 'FX' })]

    const summary = computeSummary(active, proposals, EMPTY_CSA_SUMMARY)

    expect(summary.swapCountByType).toEqual({ IRS: 2, CDS: 1 })
  })

  test('threads CSA summary through unchanged', () => {
    const summary = computeSummary([], [], {
      count: 1,
      configured: true,
      ownPosted: 1_000,
      cptyPosted: 500,
      exposure: 250,
      state: 'MarginCallOutstanding',
      regulatorHints: ['RegulatorEU', 'RegulatorUS'],
      phase: 'live',
      isFetching: false,
      isdaMasterAgreementRef: '',
      governingLaw: 'NewYork',
      imAmount: 0,
      valuationCcy: 'USD',
    })
    expect(summary.csaCount).toBe(1)
    expect(summary.csaConfigured).toBe(true)
    expect(summary.csaOwnPosted).toBe(1_000)
    expect(summary.csaCptyPosted).toBe(500)
    expect(summary.csaExposure).toBe(250)
    expect(summary.csaState).toBe('MarginCallOutstanding')
    expect(summary.csaRegulatorHints).toEqual(['RegulatorEU', 'RegulatorUS'])
  })

  test('preserves null exposure (no mark yet) through the aggregation', () => {
    const summary = computeSummary([], [], {
      count: 1,
      configured: true,
      ownPosted: 0,
      cptyPosted: 0,
      exposure: null,
      state: 'Active',
      regulatorHints: [],
      phase: 'live',
      isFetching: false,
      isdaMasterAgreementRef: '',
      governingLaw: 'NewYork',
      imAmount: 0,
      valuationCcy: 'USD',
    })
    expect(summary.csaExposure).toBeNull()
  })

  test('aggregates bookNpv across active rows, treating null as 0', () => {
    const active: SwapRow[] = [
      row({ notional: 1, direction: 'pay', npv: 100_000 }),
      row({ notional: 1, direction: 'pay', npv: 250_000 }),
      row({ notional: 1, direction: 'pay', npv: null }),
    ]
    const summary = computeSummary(active, [], EMPTY_CSA_SUMMARY)
    expect(summary.bookNpv).toBe(350_000)
  })

  test('aggregates bookDv01 across active rows, treating null as 0', () => {
    const active: SwapRow[] = [
      row({ notional: 1, direction: 'pay', dv01: -100 }),
      row({ notional: 1, direction: 'pay', dv01: -250 }),
      row({ notional: 1, direction: 'pay', dv01: null }),
    ]
    const summary = computeSummary(active, [], EMPTY_CSA_SUMMARY)
    expect(summary.bookDv01).toBe(-350)
  })

  test('returns zero bookNpv and bookDv01 for empty active rows', () => {
    const summary = computeSummary([], [], EMPTY_CSA_SUMMARY)
    expect(summary.bookNpv).toBe(0)
    expect(summary.bookDv01).toBe(0)
  })
})
