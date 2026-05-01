/**
 * Tests for useActiveContracts — margin account, outstanding effects,
 * and terminate-proposal resolution.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { LedgerClient } from '@/shared/ledger/client'
import { EFFECT_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import { useActiveContracts } from '../use-active-contracts'
import { fakeClient, makeWrapper, wfPayload } from './active-contracts-fixtures'

vi.mock('@/shared/ledger/generated/package-ids', () => ({
  IRSFORGE_PACKAGE_ID: 'test-irsforge-pkg',
  DAML_FINANCE_DATA_PACKAGE_ID: 'test-daml-finance-data-pkg',
  DAML_FINANCE_LIFECYCLE_PACKAGE_ID: 'test-daml-finance-lifecycle-pkg',
  DAML_FINANCE_HOLDING_PACKAGE_ID: 'test-daml-finance-holding-pkg',
  DAML_FINANCE_CLAIMS_PACKAGE_ID: 'test-daml-finance-claims-pkg',
  DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID: 'test-daml-finance-instrument-swap-pkg',
}))

describe('useActiveContracts — effects, unwind', () => {
  test('dispatches SET_OUTSTANDING_EFFECTS count from Effect query', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        { contractId: 'wf-1', payload: wfPayload({ notional: '1000000' }) },
      ],
      [EFFECT_TEMPLATE_ID]: [
        { contractId: 'e-1', payload: {} },
        { contractId: 'e-2', payload: {} },
      ],
    })
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Active',
            proposalContractId: 'p',
            notionalMatch: 1_000_000,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_OUTSTANDING_EFFECTS', count: 2 }),
    )
  })

  test('dispatches SET_PENDING_UNWIND when a TerminateProposal is found for the active party', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [],
      'Swap.Terminate:TerminateProposal': [
        {
          contractId: 'tp-1',
          payload: {
            proposer: 'Alice::ns',
            counterparty: 'Bob::ns',
            workflowCid: 'wf-1',
            proposedPvAmount: '5000.00',
            reason: 'Unwind',
            proposedAt: '2026-04-16',
          },
        },
      ],
    })
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Active',
            proposalContractId: 'p',
            notionalMatch: null,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => {
      const call = dispatch.mock.calls.find(
        (c) => (c[0] as { type: string }).type === 'SET_PENDING_UNWIND',
      )
      expect(call).toBeDefined()
      expect(call![0]).toMatchObject({
        type: 'SET_PENDING_UNWIND',
        value: {
          role: 'proposer',
          proposal: {
            proposalCid: 'tp-1',
            proposer: 'Alice::ns',
            counterparty: 'Bob::ns',
            pvAmount: 5000,
            reason: 'Unwind',
          },
        },
      })
    })
  })

  test('dispatches SET_PENDING_UNWIND=null when no TerminateProposal found', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [],
      'Swap.Terminate:TerminateProposal': [],
    })
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Active',
            proposalContractId: 'p',
            notionalMatch: null,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_PENDING_UNWIND', value: null }),
    )
  })
})

// IRS instrument template ID as resolved by the test mock:
// DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID = 'test-daml-finance-instrument-swap-pkg'
const IRS_TEMPLATE =
  'test-daml-finance-instrument-swap-pkg:Daml.Finance.Instrument.Swap.V0.InterestRate.Instrument:Instrument'

function makeIrsInstrument(instrumentId: string, terminationDate: string) {
  return {
    contractId: `instr-${instrumentId}`,
    payload: {
      // Daml Finance V0 swap-instrument templates flatten InstrumentKey at top
      // level — see swap-instrument-types.ts for the full convention.
      depository: 'Dep',
      issuer: 'Op',
      id: { unpack: instrumentId },
      version: '0',
      holdingStandard: 'TransferableFungible',
      description: 'Test IRS',
      floatingRate: {
        referenceRateId: 'SOFR',
        referenceRateType: { tag: 'SingleFixing', value: {} },
        fixingDates: {
          businessDayAdjustment: {
            calendarType: { tag: 'NoCalendar', value: {} },
            convention: 'NoAdjustment',
          },
          dateOffset: {
            period: 'D',
            periodMultiplier: -2,
            dayType: { tag: 'Business', value: {} },
          },
        },
        dayCountConvention: 'Act360',
        currency: {
          depository: 'Dep',
          issuer: 'Op',
          id: { unpack: 'USD' },
          version: '0',
          holdingStandard: 'TransferableFungible',
        },
        useArrears: false,
        resetAfterPayment: false,
      },
      ownerReceivesFix: false,
      fixRate: '0.05',
      periodicSchedule: {
        effectiveDate: '2024-01-15',
        terminationDate,
        firstRegularPeriodStartDate: null,
        lastRegularPeriodEndDate: null,
        frequency: {
          rollConvention: { tag: 'DOM', value: 15 },
          period: 'M',
          periodMultiplier: 6,
        },
        effectiveDateBusinessDayAdjustment: {
          calendarType: { tag: 'NoCalendar', value: {} },
          convention: 'NoAdjustment',
        },
        terminationDateBusinessDayAdjustment: {
          calendarType: { tag: 'NoCalendar', value: {} },
          convention: 'NoAdjustment',
        },
        regularPeriodBusinessDayAdjustment: {
          calendarType: { tag: 'NoCalendar', value: {} },
          convention: 'NoAdjustment',
        },
      },
      dayCountConvention: 'Act360',
      currency: {
        depository: 'Dep',
        issuer: 'Op',
        id: { unpack: 'USD' },
        version: '0',
        holdingStandard: 'TransferableFungible',
      },
    },
  }
}

describe('useActiveContracts — isPastMaturity derived from on-chain instrument', () => {
  test('dispatches SET_IS_PAST_MATURITY=true when instrument terminationDate is in the past', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        { contractId: 'wf-1', payload: wfPayload({ notional: '1000000' }) },
      ],
      [IRS_TEMPLATE]: [makeIrsInstrument('IRS-1', '2025-01-15')],
    })
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Active',
            proposalContractId: 'p',
            notionalMatch: 1_000_000,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => {
      const calls = dispatch.mock.calls.filter(
        (c) => (c[0] as { type: string }).type === 'SET_IS_PAST_MATURITY',
      )
      const lastCall = calls[calls.length - 1]
      expect(lastCall).toBeDefined()
      expect(lastCall[0]).toEqual({ type: 'SET_IS_PAST_MATURITY', value: true })
    })
  })

  test('dispatches SET_IS_PAST_MATURITY=false when instrument terminationDate is in the future', async () => {
    const dispatch = vi.fn()
    const client = fakeClient({
      'Swap.Workflow:SwapWorkflow': [
        { contractId: 'wf-1', payload: wfPayload({ notional: '1000000' }) },
      ],
      [IRS_TEMPLATE]: [makeIrsInstrument('IRS-1', '2099-12-31')],
    })
    renderHook(
      () =>
        useActiveContracts(
          {
            client: client as unknown as LedgerClient,
            activeParty: 'Alice',
            swapStatus: 'Active',
            proposalContractId: 'p',
            notionalMatch: 1_000_000,
          },
          dispatch,
        ),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => {
      const calls = dispatch.mock.calls.filter(
        (c) => (c[0] as { type: string }).type === 'SET_IS_PAST_MATURITY',
      )
      const lastCall = calls[calls.length - 1]
      expect(lastCall).toBeDefined()
      expect(lastCall[0]).toEqual({ type: 'SET_IS_PAST_MATURITY', value: false })
    })
  })
})
