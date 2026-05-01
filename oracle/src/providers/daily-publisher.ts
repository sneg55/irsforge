/**
 * publishDailyWindow — back-fill a rolling window of daily Observation
 * contracts for every enabled FloatingRateIndex.
 *
 * Why:
 *   SOFR-style compounded-in-arrears coupons need an overnight rate for
 *   every calendar day in the accrual window — not just one fixing per
 *   coupon period. Stage B's pricer + lifecycle rule reads daily
 *   Observations from the ledger; this publisher guarantees they exist.
 *
 * Idempotency:
 *   The publisher queries existing observations per indexId and skips
 *   any (indexId, date) already on-chain. Running it multiple times per
 *   day is safe; running it alongside the legacy per-fixing-event
 *   publisher is also safe.
 *
 * Date semantics:
 *   `windowDays = N` writes observations for the N calendar days strictly
 *   before `asOf` (i.e. `[asOf - N, asOf - 1]`). `asOf` itself is excluded
 *   because the official rate for "today" typically isn't published until
 *   after market close.
 */

export interface DailyObservation {
  indexId: string
  date: Date
  rate: number
}

export interface DailyPublisherLedger {
  createObservation: (indexId: string, date: Date, rate: number) => Promise<void>
  listObservations: (indexId: string) => Promise<DailyObservation[]>
}

export interface DailyPublisherInput {
  ledger: DailyPublisherLedger
  rateSource: (indexId: string, date: Date) => number
  indexIds: string[]
  asOf: Date
  windowDays: number
}

function isoDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function publishDailyWindow(input: DailyPublisherInput): Promise<void> {
  const { ledger, rateSource, indexIds, asOf, windowDays } = input
  for (const indexId of indexIds) {
    const existing = await ledger.listObservations(indexId)
    const existingKeys = new Set(existing.map((o) => isoDateKey(o.date)))
    for (let i = windowDays; i >= 1; i--) {
      const d = new Date(asOf)
      d.setUTCDate(d.getUTCDate() - i)
      const key = isoDateKey(d)
      if (existingKeys.has(key)) continue
      const rate = rateSource(indexId, d)
      await ledger.createObservation(indexId, d, rate)
    }
  }
}
