import type { LedgerClient } from '../../shared/ledger-client.js'
import { DAML_FINANCE_EFFECT_TEMPLATE_ID } from '../../shared/template-ids.js'

export interface EffectRow {
  contractId: string
  payload: {
    targetInstrument: { id: { unpack: string } }
    /**
     * Daml Finance Effect encodes `eventTime` as ISO-8601 with timezone;
     * e.g. "2026-04-19T00:00:00Z". We only inspect the date prefix for
     * idempotency: an Effect exists for (instrument, date) iff the
     * prefix matches.
     */
    eventTime: string
  }
}

export async function queryAllEffects(client: LedgerClient): Promise<EffectRow[]> {
  return (await client.query(DAML_FINANCE_EFFECT_TEMPLATE_ID)) as EffectRow[]
}

export function effectExistsFor(
  effects: EffectRow[],
  instrumentId: string,
  dateIso: string,
): boolean {
  return effects.some(
    (e) =>
      e.payload.targetInstrument.id.unpack === instrumentId &&
      e.payload.eventTime.startsWith(dateIso),
  )
}
