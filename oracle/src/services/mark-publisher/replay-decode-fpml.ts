// FpML resolver — Daml.Finance.Instrument.Swap.V0.Fpml.Instrument.
//
// Same on-chain template backs BASIS, XCCY, and FpML-imported swaps. This
// module does the ledger-side work (resolve instrument by id, hydrate
// swapStreams) and then delegates to @irsforge/shared-pricing for the
// pure parse + classify + build-config pipeline. That way the oracle
// replay harness and the frontend blotter share exactly the same shaping
// logic.

import type { SwapConfig } from '@irsforge/shared-pricing'
import {
  type FpmlSwapStreamPayload,
  parsedFpmlToSwapConfig,
  streamsToParsedFpml,
} from '@irsforge/shared-pricing'
import { DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID } from '../../shared/generated/package-ids.js'
import type { LedgerClient } from '../../shared/ledger-client.js'
import type { SwapWorkflow } from '../../shared/types.js'

export const FPML_INSTRUMENT_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.Fpml.Instrument:Instrument`

export interface FpmlInstrumentPayload {
  description: string
  swapStreams: FpmlSwapStreamPayload[]
  issuerPartyRef: string
  id: { unpack: string }
}

export async function resolveFpmlLike(
  client: LedgerClient,
  wf: { payload: SwapWorkflow },
): Promise<SwapConfig> {
  const instrumentId = wf.payload.instrumentKey.id.unpack
  const rows = (await client.query(FPML_INSTRUMENT_TEMPLATE_ID)) as Array<{
    contractId: string
    payload: FpmlInstrumentPayload
  }>
  const inst = rows.find((r) => r.payload.id.unpack === instrumentId)
  if (!inst) {
    throw new Error(`resolveFpmlLike: Fpml instrument ${instrumentId} not on ledger`)
  }
  const parsed = streamsToParsedFpml(inst.payload.swapStreams)
  return parsedFpmlToSwapConfig(parsed)
}

// resolveBasis / resolveXccy / resolveFpml stay as aliases so the
// dispatcher in replay.ts reads as one resolver per swap family.
export const resolveBasis = resolveFpmlLike
export const resolveXccy = resolveFpmlLike
export const resolveFpml = resolveFpmlLike
