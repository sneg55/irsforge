import type { LedgerClient } from '../../shared/ledger-client.js'
import {
  ASSET_INSTRUMENT_TEMPLATE_ID,
  CCY_INSTRUMENT_TEMPLATE_ID,
  CDS_INSTRUMENT_TEMPLATE_ID,
  FX_INSTRUMENT_TEMPLATE_ID,
  IRS_INSTRUMENT_TEMPLATE_ID,
} from '../../shared/template-ids.js'

interface InstrumentRow {
  payload: {
    id: { unpack: string }
    periodicSchedule?: { terminationDate?: string }
    maturityDate?: string
  }
}

/**
 * Build a map of instrument-id → maturity-date (ISO) across every swap
 * family the demo supports. IRS/CDS/CCY/ASSET carry the maturity date
 * in `periodicSchedule.terminationDate`; FX carries it as the
 * top-level `maturityDate` field. FpML is omitted — its maturity lives
 * inside per-stream payment schedules we do not parse in the demo.
 */
export async function fetchAllMaturityDates(client: LedgerClient): Promise<Map<string, string>> {
  const byTemplate = [
    IRS_INSTRUMENT_TEMPLATE_ID,
    CDS_INSTRUMENT_TEMPLATE_ID,
    CCY_INSTRUMENT_TEMPLATE_ID,
    ASSET_INSTRUMENT_TEMPLATE_ID,
    FX_INSTRUMENT_TEMPLATE_ID,
  ]
  const results = await Promise.all(
    byTemplate.map(async (tid) => (await client.query(tid)) as InstrumentRow[]),
  )
  const map = new Map<string, string>()
  for (const rows of results) {
    for (const r of rows) {
      const id = r.payload.id.unpack
      const maturity = r.payload.periodicSchedule?.terminationDate ?? r.payload.maturityDate ?? null
      if (maturity) map.set(id, maturity)
    }
  }
  return map
}
