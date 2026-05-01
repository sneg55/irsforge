// CDS resolver — Daml.Finance.Instrument.Swap.V0.CreditDefault.Instrument.
// The on-chain shape carries `defaultProbabilityReferenceId` and
// `recoveryRateReferenceId`; the actual rate values flow through the
// standard observation pathway. Phase 4's `use-blotter-valuation.ts`
// hardcodes recoveryRate at 0.4 — the replay decoder mirrors that
// constant so replay = publisher until on-chain Recovery wiring lands.

import type {
  FixedLegConfig,
  Frequency,
  ProtectionLegConfig,
  SwapConfig,
} from '@irsforge/shared-pricing'
import { DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID } from '../../shared/generated/package-ids.js'
import type { LedgerClient } from '../../shared/ledger-client.js'
import type { SwapWorkflow } from '../../shared/types.js'
import { mapDayCount } from './replay-decode.js'
import type { CdsInstrumentPayload } from './replay-types.js'

export const CDS_INSTRUMENT_TEMPLATE_ID = `${DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID}:Daml.Finance.Instrument.Swap.V0.CreditDefault.Instrument:Instrument`

const DEFAULT_FREQUENCY: Frequency = 'Quarterly'

// Mirrors app/src/features/blotter/hooks/use-blotter-valuation.ts:43-44 —
// recoveryRate hardcoded at 0.4 until on-chain Recovery observation wires
// in. Lifted here as a named constant so the parity assertion has one
// place to flip.
const DEFAULT_RECOVERY_RATE = 0.4

export async function resolveCds(
  client: LedgerClient,
  wf: { payload: SwapWorkflow },
): Promise<SwapConfig> {
  const instrumentId = wf.payload.instrumentKey.id.unpack
  const rows = (await client.query(CDS_INSTRUMENT_TEMPLATE_ID)) as Array<{
    contractId: string
    payload: CdsInstrumentPayload
  }>
  const inst = rows.find((r) => r.payload.id.unpack === instrumentId)
  if (!inst) {
    throw new Error(`resolveCds: CDS instrument ${instrumentId} not on ledger`)
  }
  return mapCdsToSwapConfig(inst.payload, parseFloat(wf.payload.notional))
}

export function mapCdsToSwapConfig(p: CdsInstrumentPayload, notional: number): SwapConfig {
  const effectiveDate = new Date(p.periodicSchedule.effectiveDate)
  const maturityDate = new Date(p.periodicSchedule.terminationDate)
  const schedule = {
    startDate: effectiveDate,
    endDate: maturityDate,
    frequency: DEFAULT_FREQUENCY,
  }
  const dayCount = mapDayCount(p.dayCountConvention)
  // Sign carried via signed notional; `direction: 'receive'` keeps
  // pricing's directionSign() from double-flipping. See replay-decode-irs.ts.
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
  const protection: ProtectionLegConfig = {
    legType: 'protection',
    direction: 'receive',
    notional: -sign * notional,
    recoveryRate: DEFAULT_RECOVERY_RATE,
  }
  return {
    type: 'CDS',
    legs: [fixed, protection],
    tradeDate: effectiveDate,
    effectiveDate,
    maturityDate,
  }
}
