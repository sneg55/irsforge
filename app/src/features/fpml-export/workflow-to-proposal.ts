import type {
  IrsInstrumentPayload,
  SwapInstrumentPayload,
} from '@/shared/ledger/swap-instrument-types'
import type { IrsLikePayload, TypedProposal } from '../fpml-import/types'

export type ExportableSwapType = 'IRS' | 'OIS'

export interface WorkflowMinimal {
  swapType: string
  notional: string
}

/**
 * Convert an active workflow's on-chain instrument into the canonical
 * TypedProposal shape so the Export path can feed it to `buildFpmlXml`.
 * Only IRS and OIS are supported today — both ride the Daml Finance
 * InterestRate instrument (see `SWAP_INSTRUMENT_TEMPLATE_BY_TYPE` in
 * `template-ids.ts`), so one code path covers both and only the emitted
 * `type` tag differs.
 *
 * BASIS and XCCY are not exportable yet: their economics are carried in
 * the FpML instrument's `swapStreams[]` variant records, and the Phase-2
 * `FpmlSwapStreamPayload` interface is intentionally stripped down to
 * `payerPartyReference + receiverPartyReference`. Widening that shape
 * (parsing the Daml variant encoding for `notionalScheduleValue` and
 * `rateTypeValue`) is a Stage F follow-up tracked in the index plan.
 */
export function workflowToProposalPayload(
  workflow: WorkflowMinimal,
  instrument: SwapInstrumentPayload,
): TypedProposal {
  if (!isExportable(workflow.swapType)) {
    throw new Error(
      `Export is not supported for ${workflow.swapType} — only IRS and OIS today. ` +
        `BASIS/XCCY Export is queued as a Stage F follow-up (widen FpmlSwapStreamPayload).`,
    )
  }
  // IRS + OIS both resolve to the Daml Finance InterestRate instrument, so
  // consumers receive an IrsInstrumentPayload regardless of swapType.
  const payload = instrument.payload as IrsInstrumentPayload
  return {
    type: workflow.swapType,
    payload: irsPayloadFrom(workflow, payload),
  }
}

export function isExportable(swapType: string): swapType is ExportableSwapType {
  return swapType === 'IRS' || swapType === 'OIS'
}

function irsPayloadFrom(workflow: WorkflowMinimal, instr: IrsInstrumentPayload): IrsLikePayload {
  // The Daml Finance InterestRate instrument does NOT carry notional on the
  // template payload — notional lives on SwapWorkflow. Read the workflow's
  // scalar notional; if parsing fails (malformed Decimal string) fall back
  // to 0 so Export still emits a valid, if empty, FpML envelope.
  const notional = Number(workflow.notional)
  return {
    notional: Number.isFinite(notional) ? notional : 0,
    currency: instr.currency.id.unpack,
    fixRate: Number(instr.fixRate),
    floatingRateId: instr.floatingRate.referenceRateId,
    floatingSpread: 0,
    startDate: instr.periodicSchedule.effectiveDate,
    maturityDate: instr.periodicSchedule.terminationDate,
    dayCount: instr.dayCountConvention,
    // On-chain instruments don't store direction separately from the payer party
    // field which would need the full on-chain counterparty context to decode.
    // Default to 'receive' (owner receives fixed) — matches workspace default.
    fixedDirection: 'receive',
  }
}
