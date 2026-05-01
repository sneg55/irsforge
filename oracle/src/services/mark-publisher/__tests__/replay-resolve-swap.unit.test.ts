// Per-family dispatch test for resolveSwapConfig. Split out of
// replay.unit.test.ts to keep each file under the 300-line limit.

import { describe, expect, it } from 'vitest'
import {
  IRS_INSTRUMENT_TEMPLATE_ID,
  SWAP_WORKFLOW_TEMPLATE_ID,
} from '../../../shared/template-ids.js'
import { resolveSwapConfig } from '../replay.js'
import { baseWfPayload, fakeClient } from './fixtures/replay-fixtures.js'

describe('resolveSwapConfig — workflow lookup', () => {
  it('errors when the workflow cid is not on the ledger', async () => {
    const client = fakeClient({
      [SWAP_WORKFLOW_TEMPLATE_ID]: [],
    })
    await expect(resolveSwapConfig(client, 'wf-missing')).rejects.toThrow(
      /workflow wf-missing not on ledger/,
    )
  })
})

describe('resolveSwapConfig — IRS / OIS routing', () => {
  it('routes IRS to resolveIrsLike (errors when instrument missing)', async () => {
    const client = fakeClient({
      [SWAP_WORKFLOW_TEMPLATE_ID]: [
        { contractId: 'wf1', payload: { swapType: 'IRS', ...baseWfPayload } },
      ],
      [IRS_INSTRUMENT_TEMPLATE_ID]: [],
    })
    await expect(resolveSwapConfig(client, 'wf1')).rejects.toThrow(
      /resolveIrsLike: IRS instrument instr-x not on ledger/,
    )
  })

  it('routes OIS through the same IRS-like resolver', async () => {
    const client = fakeClient({
      [SWAP_WORKFLOW_TEMPLATE_ID]: [
        { contractId: 'wf1', payload: { swapType: 'OIS', ...baseWfPayload } },
      ],
      [IRS_INSTRUMENT_TEMPLATE_ID]: [],
    })
    await expect(resolveSwapConfig(client, 'wf1')).rejects.toThrow(
      /resolveIrsLike: IRS instrument instr-x not on ledger/,
    )
  })

  it('returns a SwapConfig for IRS when the instrument is present (happy path)', async () => {
    const client = fakeClient({
      [SWAP_WORKFLOW_TEMPLATE_ID]: [
        { contractId: 'wf1', payload: { swapType: 'IRS', ...baseWfPayload } },
      ],
      [IRS_INSTRUMENT_TEMPLATE_ID]: [
        {
          contractId: 'irs1',
          payload: {
            description: 'desc',
            floatingRate: { referenceRateId: 'USD-SOFR' },
            ownerReceivesFix: true,
            fixRate: '0.04',
            periodicSchedule: {
              effectiveDate: '2026-04-17',
              terminationDate: '2031-04-17',
              firstRegularPeriodStartDate: null,
              lastRegularPeriodEndDate: null,
            },
            dayCountConvention: 'Act360',
            id: { unpack: 'instr-x' },
          },
        },
      ],
    })
    const cfg = await resolveSwapConfig(client, 'wf1')
    expect(cfg.type).toBe('IRS')
    expect(cfg.legs).toHaveLength(2)
    expect(cfg.legs[0]?.legType).toBe('fixed')
    expect(cfg.legs[1]?.legType).toBe('float')
  })
})

describe('resolveSwapConfig — CDS / BASIS / XCCY / FPML routing', () => {
  it('routes CDS to resolveCds (throws when instrument missing, not when swapType)', async () => {
    const client = fakeClient({
      [SWAP_WORKFLOW_TEMPLATE_ID]: [
        { contractId: 'wf1', payload: { swapType: 'CDS', ...baseWfPayload } },
      ],
    })
    await expect(resolveSwapConfig(client, 'wf1')).rejects.toThrow(/CDS instrument.*not on ledger/)
  })

  it('routes BASIS / XCCY / FPML to resolveFpmlLike (instrument missing)', async () => {
    for (const t of ['BASIS', 'XCCY', 'FPML']) {
      const client = fakeClient({
        [SWAP_WORKFLOW_TEMPLATE_ID]: [
          { contractId: 'wf1', payload: { swapType: t, ...baseWfPayload } },
        ],
      })
      await expect(resolveSwapConfig(client, 'wf1')).rejects.toThrow(
        /Fpml instrument.*not on ledger/,
      )
    }
  })

  it('accepts the legacy "FpML" casing alongside upper-case "FPML"', async () => {
    const client = fakeClient({
      [SWAP_WORKFLOW_TEMPLATE_ID]: [
        { contractId: 'wf1', payload: { swapType: 'FpML', ...baseWfPayload } },
      ],
    })
    await expect(resolveSwapConfig(client, 'wf1')).rejects.toThrow(/Fpml instrument.*not on ledger/)
  })
})

describe('resolveSwapConfig — deprecated and unknown families', () => {
  it('rejects deprecated CCY / FX / ASSET families', async () => {
    for (const t of ['CCY', 'FX', 'ASSET']) {
      const client = fakeClient({
        [SWAP_WORKFLOW_TEMPLATE_ID]: [
          { contractId: 'wf1', payload: { swapType: t, ...baseWfPayload } },
        ],
      })
      await expect(resolveSwapConfig(client, 'wf1')).rejects.toThrow(/deprecated\/disabled/)
    }
  })

  it('rejects unknown swapType', async () => {
    const client = fakeClient({
      [SWAP_WORKFLOW_TEMPLATE_ID]: [
        { contractId: 'wf1', payload: { swapType: 'BOGUS', ...baseWfPayload } },
      ],
    })
    await expect(resolveSwapConfig(client, 'wf1')).rejects.toThrow(/unknown swapType/)
  })
})
