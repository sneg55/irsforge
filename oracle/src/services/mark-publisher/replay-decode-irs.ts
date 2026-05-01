// IRS / OIS resolver — same Daml.Finance.Instrument.Swap.V0.InterestRate
// template handles both. Per-family decoder (Phase 6 Stage B) extracted
// from replay-decode.ts so that BASIS / XCCY / CDS / FpML can sit
// alongside without one giant file.

import type {
  FixedLegConfig,
  FloatLegConfig,
  Frequency,
  SwapConfig,
} from '@irsforge/shared-pricing'
import { DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID } from '../../shared/generated/package-ids.js'
import type { LedgerClient } from '../../shared/ledger-client.js'
import type { SwapWorkflow } from '../../shared/types.js'
import { mapDayCount } from './replay-decode.js'
import type { IrsInstrumentPayload } from './replay-types.js'

export const IRS_INSTRUMENT_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.InterestRate.Instrument:Instrument`

// The on-chain InterestRate instrument doesn't carry an explicit period
// frequency — schedules are derived from frequency-aware roll. The mark
// publisher only needs PV, not cashflow detail, so default to Quarterly.
const DEFAULT_FREQUENCY: Frequency = 'Quarterly'

export async function resolveIrsLike(
  client: LedgerClient,
  wf: { payload: SwapWorkflow },
): Promise<SwapConfig> {
  const instrumentId = wf.payload.instrumentKey.id.unpack
  const irsRows = (await client.query(IRS_INSTRUMENT_TEMPLATE_ID)) as Array<{
    contractId: string
    payload: IrsInstrumentPayload
  }>
  const irs = irsRows.find((r) => r.payload.id.unpack === instrumentId)
  if (!irs) {
    throw new Error(`resolveIrsLike: IRS instrument ${instrumentId} not on ledger`)
  }
  return mapIrsToSwapConfig(irs.payload, parseFloat(wf.payload.notional))
}

export function mapIrsToSwapConfig(p: IrsInstrumentPayload, notional: number): SwapConfig {
  const effectiveDate = new Date(p.periodicSchedule.effectiveDate)
  const maturityDate = new Date(p.periodicSchedule.terminationDate)
  const schedule = {
    startDate: effectiveDate,
    endDate: maturityDate,
    frequency: DEFAULT_FREQUENCY,
  }
  const dayCount = mapDayCount(p.dayCountConvention)
  // Sign is carried via signed notional (pre-existing oracle convention);
  // `direction` stays 'receive' so pricing's directionSign() does not
  // double-flip the PV. Swapping to positive-notional + direction is a
  // larger refactor tracked separately.
  const sign = p.ownerReceivesFix ? 1 : -1
  const fixed: FixedLegConfig = {
    legType: 'fixed',
    direction: 'receive',
    currency: 'USD',
    notional: sign * notional,
    rate: parseFloat(p.fixRate),
    dayCount,
    schedule,
  }
  const float: FloatLegConfig = {
    legType: 'float',
    direction: 'receive',
    currency: 'USD',
    notional: -sign * notional,
    indexId: p.floatingRate.referenceRateId,
    spread: 0,
    dayCount,
    schedule,
  }
  return {
    type: 'IRS',
    legs: [fixed, float],
    tradeDate: effectiveDate,
    effectiveDate,
    maturityDate,
  }
}
