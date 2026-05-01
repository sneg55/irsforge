import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import type {
  CdsInstrumentPayload,
  IrsInstrumentPayload,
} from '@/shared/ledger/swap-instrument-types.js'
import {
  CDS_INSTRUMENT_TEMPLATE_ID,
  IRS_INSTRUMENT_TEMPLATE_ID,
} from '@/shared/ledger/template-ids.js'
import type { ContractResult } from '@/shared/ledger/types.js'
import { useSwapInstruments } from '../use-swap-instruments.js'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// ---------------------------------------------------------------------------
// Minimal fixture payloads — type-correct but not semantically complete
// ---------------------------------------------------------------------------

// The Daml Finance V0 swap-instrument templates flatten the InstrumentKey
// fields onto the template top level (no `instrument: InstrumentKey` wrapper).
// Fixtures mirror that flattened shape verbatim — see the docstring on
// swap-instrument-types.ts.
const irsFixture: ContractResult<IrsInstrumentPayload> = {
  contractId: 'irs-cid-001',
  payload: {
    depository: 'Depository::1',
    issuer: 'Operator::1',
    id: { unpack: 'IRS-001' },
    version: '0',
    holdingStandard: 'TransferableFungible',
    description: 'SOFR IRS 5Y',
    floatingRate: { referenceRateId: 'SOFR/ON' },
    ownerReceivesFix: false,
    fixRate: '0.0485',
    periodicSchedule: {
      effectiveDate: '2026-04-16',
      terminationDate: '2031-04-16',
      firstRegularPeriodStartDate: null,
      lastRegularPeriodEndDate: null,
    },
    dayCountConvention: 'Act360',
    currency: {
      depository: 'Depository::1',
      issuer: 'Operator::1',
      id: { unpack: 'USD' },
      version: '0',
      holdingStandard: 'TransferableFungible',
    },
  },
}

const cdsFixture: ContractResult<CdsInstrumentPayload> = {
  contractId: 'cds-cid-001',
  payload: {
    depository: 'Depository::1',
    issuer: 'Operator::1',
    id: { unpack: 'CDS-001' },
    version: '0',
    holdingStandard: 'TransferableFungible',
    description: 'CDS on ACME Corp',
    defaultProbabilityReferenceId: 'ACME/DefaultProb',
    recoveryRateReferenceId: 'ACME/RecoveryRate',
    ownerReceivesFix: true,
    fixRate: '0.0120',
    periodicSchedule: {
      effectiveDate: '2026-04-16',
      terminationDate: '2031-04-16',
      firstRegularPeriodStartDate: null,
      lastRegularPeriodEndDate: null,
    },
    dayCountConvention: 'Act360',
    currency: {
      depository: 'Depository::1',
      issuer: 'Operator::1',
      id: { unpack: 'USD' },
      version: '0',
      holdingStandard: 'TransferableFungible',
    },
  },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSwapInstruments', () => {
  test('indexes results by id.unpack across multiple families', async () => {
    const fakeClient = {
      query: vi.fn(async (templateId: string) => {
        if (templateId === IRS_INSTRUMENT_TEMPLATE_ID) return [irsFixture]
        if (templateId === CDS_INSTRUMENT_TEMPLATE_ID) return [cdsFixture]
        return []
      }),
    }

    const { result } = renderHook(() => useSwapInstruments(fakeClient as never, ['IRS', 'CDS']), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const { byInstrumentId } = result.current
    expect(byInstrumentId.size).toBe(2)

    const irsEntry = byInstrumentId.get('IRS-001')
    expect(irsEntry?.swapType).toBe('IRS')
    // Type-narrowed access
    if (irsEntry?.swapType === 'IRS') {
      expect(irsEntry.payload.fixRate).toBe('0.0485')
    }

    const cdsEntry = byInstrumentId.get('CDS-001')
    expect(cdsEntry?.swapType).toBe('CDS')
  })

  test('empty families returns empty map without firing queries', async () => {
    const queryFn = vi.fn()
    const fakeClient = { query: queryFn }

    const { result } = renderHook(() => useSwapInstruments(fakeClient as never, []), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.byInstrumentId.size).toBe(0)
    expect(queryFn).not.toHaveBeenCalled()
  })

  test('null client returns empty map without firing queries', async () => {
    const { result } = renderHook(() => useSwapInstruments(null, ['IRS']), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.byInstrumentId.size).toBe(0)
  })
})
