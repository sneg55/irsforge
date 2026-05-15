import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OversightPage } from '../page'

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

vi.mock('canton-party-directory/react', () => ({
  usePartyDirectory: () => ({ displayName: (id: string) => id, loading: false }),
}))

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({ client: null, activeParty: 'Reg' }),
}))

const INSTRUMENT_KEY = {
  id: { unpack: 'I1' },
  version: '1',
  depository: 'D',
  issuer: 'I',
  holdingStandard: 'TF',
}

const IRS_INSTRUMENT_OLD = {
  swapType: 'IRS' as const,
  payload: {
    ...INSTRUMENT_KEY,
    description: '',
    floatingRate: { referenceRateId: 'USD-SOFR' },
    ownerReceivesFix: true,
    fixRate: '0.04',
    periodicSchedule: {
      effectiveDate: '2024-01-01',
      terminationDate: '2026-01-01',
      firstRegularPeriodStartDate: null,
      lastRegularPeriodEndDate: null,
    },
    dayCountConvention: 'Act360',
    currency: { ...INSTRUMENT_KEY, id: { unpack: 'USD' } },
  },
}

const IRS_INSTRUMENT_NEW = {
  ...IRS_INSTRUMENT_OLD,
  payload: {
    ...IRS_INSTRUMENT_OLD.payload,
    periodicSchedule: {
      ...IRS_INSTRUMENT_OLD.payload.periodicSchedule,
      effectiveDate: '2028-06-01',
    },
  },
}

vi.mock('@/shared/hooks/use-swap-instruments', () => ({
  useSwapInstruments: () => ({
    byInstrumentId: new Map([
      ['I_OLD', IRS_INSTRUMENT_OLD],
      ['I_NEW', IRS_INSTRUMENT_NEW],
    ]),
    isLoading: false,
  }),
}))

vi.mock('../../hooks/use-all-swap-workflows', () => ({
  useAllSwapWorkflows: () => ({
    workflows: [
      // Intentionally out of date order — the page must sort, not the hook.
      {
        contractId: 'wf-old',
        payload: {
          swapType: 'IRS',
          partyA: 'PA',
          partyB: 'PB',
          operator: 'Op',
          regulators: ['Reg'],
          scheduler: 'Sch',
          instrumentKey: { ...INSTRUMENT_KEY, id: { unpack: 'I_OLD' } },
          notional: '100000000.0',
        },
      },
      {
        contractId: 'wf-new',
        payload: {
          swapType: 'IRS',
          partyA: 'PA',
          partyB: 'PB',
          operator: 'Op',
          regulators: ['Reg'],
          scheduler: 'Sch',
          instrumentKey: { ...INSTRUMENT_KEY, id: { unpack: 'I_NEW' } },
          notional: '200000000.0',
        },
      },
    ],
    matured: [
      {
        contractId: 'mat-old',
        payload: {
          operator: 'Op',
          partyA: 'PA',
          partyB: 'PB',
          regulators: ['Reg'],
          scheduler: 'Sch',
          swapType: 'IRS',
          instrumentKey: { ...INSTRUMENT_KEY, id: { unpack: 'I_OLD' } },
          notional: '50000000.0',
          actualMaturityDate: '2026-02-01',
          finalSettleBatchCid: null,
          finalNetAmount: '0',
        },
      },
    ],
    terminated: [
      {
        contractId: 'term-old',
        payload: {
          operator: 'Op',
          partyA: 'PA',
          partyB: 'PB',
          regulators: ['Reg'],
          swapType: 'IRS',
          instrumentKey: { ...INSTRUMENT_KEY, id: { unpack: 'I_OLD' } },
          notional: '30000000.0',
          terminationDate: '2025-12-12',
          agreedPvAmount: '0',
          reason: 'Mutual',
          terminatedByParty: 'PA',
          settleBatchCid: null,
        },
      },
    ],
    isLoading: false,
  }),
}))

vi.mock('../../hooks/use-all-proposals-cross-org', () => ({
  useAllProposalsCrossOrg: () => ({
    proposals: [
      {
        family: 'IRS',
        contractId: 'prop-1',
        proposer: 'PA',
        counterparty: 'PB',
        payload: { notional: '10000000.0', startDate: '2029-01-01' },
      },
    ],
    isLoading: false,
  }),
}))

function bodyRowCidPrefixes(): string[] {
  return Array.from(document.querySelectorAll('tbody tr')).map((tr) => {
    const cells = tr.querySelectorAll('td')
    return cells[cells.length - 1]?.textContent?.slice(0, 4) ?? ''
  })
}

describe('OversightPage default sort', () => {
  it('orders rows by status bucket then sortDateMs desc within bucket', () => {
    render(<OversightPage />)
    // Expected order:
    //   Live   wf-new (2028)  → 'wf-n'
    //   Live   wf-old (2024)  → 'wf-o'
    //   Proposed prop-1       → 'prop'
    //   Matured  mat-old      → 'mat-'
    //   Terminated term-old   → 'term'
    expect(bodyRowCidPrefixes()).toEqual(['wf-n', 'wf-o', 'prop', 'mat-', 'term'])
    expect(screen.queryByText('5 of 5 trades')).not.toBe(null)
  })
})
