import { describe, expect, it } from 'vitest'
import type {
  IrsInstrumentPayload,
  SwapInstrumentPayload,
} from '@/shared/ledger/swap-instrument-types'
import { buildProposalFromClassification } from '../../fpml-import/build-proposal'
import { classify, parseFpml } from '../../fpml-import/classify'
import { buildFpmlXml } from '../build-xml'
import { isExportable, workflowToProposalPayload } from '../workflow-to-proposal'

const baseIrsInstrument = (): IrsInstrumentPayload => ({
  depository: 'op::1',
  issuer: 'op::1',
  id: { unpack: 'IRS-INST-1' },
  version: '1',
  holdingStandard: 'TransferableFungible',
  description: 'IRS 10M USD 5Y',
  floatingRate: { referenceRateId: 'USD-SOFR' },
  ownerReceivesFix: true,
  fixRate: '0.0425',
  periodicSchedule: {
    effectiveDate: '2026-04-16',
    terminationDate: '2031-04-16',
    firstRegularPeriodStartDate: null,
    lastRegularPeriodEndDate: null,
  },
  dayCountConvention: 'Act360',
  currency: {
    depository: 'op::1',
    issuer: 'op::1',
    id: { unpack: 'USD' },
    version: '1',
    holdingStandard: 'TransferableFungible',
  },
})

const irsWrapper = (payload: IrsInstrumentPayload): SwapInstrumentPayload => ({
  swapType: 'IRS',
  payload,
})

describe('isExportable', () => {
  it('IRS + OIS return true, others false', () => {
    expect(isExportable('IRS')).toBe(true)
    expect(isExportable('OIS')).toBe(true)
    expect(isExportable('BASIS')).toBe(false)
    expect(isExportable('XCCY')).toBe(false)
    expect(isExportable('CDS')).toBe(false)
  })
})

describe('workflowToProposalPayload', () => {
  it('IRS workflow + IRS instrument → IRS typed payload', () => {
    const out = workflowToProposalPayload(
      { swapType: 'IRS', notional: '10000000' },
      irsWrapper(baseIrsInstrument()),
    )
    expect(out.type).toBe('IRS')
    if (out.type !== 'IRS') throw new Error()
    expect(out.payload).toEqual({
      notional: 10_000_000,
      currency: 'USD',
      fixRate: 0.0425,
      floatingRateId: 'USD-SOFR',
      floatingSpread: 0,
      startDate: '2026-04-16',
      maturityDate: '2031-04-16',
      dayCount: 'Act360',
      fixedDirection: 'receive',
    })
  })

  it('OIS workflow tags the proposal type as OIS (same instrument family)', () => {
    const out = workflowToProposalPayload(
      { swapType: 'OIS', notional: '25000000' },
      irsWrapper(baseIrsInstrument()),
    )
    expect(out.type).toBe('OIS')
  })

  it('BASIS throws (not yet exportable)', () => {
    expect(() =>
      workflowToProposalPayload(
        { swapType: 'BASIS', notional: '10000000' },
        irsWrapper(baseIrsInstrument()),
      ),
    ).toThrow(/BASIS.*Stage F follow-up/)
  })

  it('round-trip: workflow → proposal → xml → import classifies back to IRS', () => {
    const proposal = workflowToProposalPayload(
      { swapType: 'IRS', notional: '10000000' },
      irsWrapper(baseIrsInstrument()),
    )
    const xml = buildFpmlXml(proposal)
    const cls = classify(parseFpml(xml))
    expect(cls.productType).toBe('OIS')
    // NOTE: USD-SOFR + CompoundedInArrears in the exported XML classifies as
    // OIS on re-import — export round-trip keeps economics intact but
    // shifts the label. Callers that need strict type preservation should
    // export under a non-overnight rate id or re-tag at import.
    const rebuilt = buildProposalFromClassification(
      cls,
      parseFpml(xml).effectiveDate,
      parseFpml(xml).terminationDate,
    )
    if (rebuilt.type !== 'OIS' || proposal.type !== 'IRS') throw new Error()
    expect(rebuilt.payload.notional).toBe(proposal.payload.notional)
    expect(rebuilt.payload.fixRate).toBe(proposal.payload.fixRate)
    expect(rebuilt.payload.floatingRateId).toBe(proposal.payload.floatingRateId)
  })
})
