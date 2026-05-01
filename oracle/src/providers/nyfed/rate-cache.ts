/**
 * Date-keyed NYFed rate cache for the daily-observation back-fill path.
 *
 * Fetches one range request covering the back-fill window, indexes the
 * SOFRAI (cumulative compounded SOFR index) series by effectiveDate, and
 * exposes a synchronous `lookup(indexId, date) -> number` that
 * `publishDailyWindowsForAllIndices` consumes.
 *
 * All NYFed-routed indices resolve to the same daily index value — the
 * cumulative compounded index is shared across SOFR overnight and SOFR
 * term variants. Compounded-in-arrears pricing recovers the period rate
 * downstream via `obs(end) / obs(start) - 1`, so a single cache serves
 * every indexId the back-fill receives.
 *
 * Fails loudly on missing dates rather than silently returning zero — the
 * top-level try/catch in `oracle/src/index.ts` downgrades to a logged
 * warning so one missing day does not sink startup.
 */

import { fetchWithTimeout } from '../../scheduler/retry.js'
import { NYFED_ALL_RATES } from './constants.js'
import type { NYFedAllRatesResponse } from './types.js'

export interface NyFedRateLookup {
  (indexId: string, date: Date): number
}

export interface BuildNyFedRateCacheOpts {
  startDate: Date
  endDate: Date
  timeoutMs: number
}

export async function buildNyFedRateCache(opts: BuildNyFedRateCacheOpts): Promise<NyFedRateLookup> {
  const start = opts.startDate.toISOString().slice(0, 10)
  const end = opts.endDate.toISOString().slice(0, 10)
  const url = `${NYFED_ALL_RATES}?startDate=${start}&endDate=${end}`

  const response = await fetchWithTimeout(url, { timeoutMs: opts.timeoutMs })
  if (!response.ok) {
    throw new Error(
      `NYFed back-fill range fetch failed (${response.status}): ${await response.text()}`,
    )
  }
  const data = (await response.json()) as NYFedAllRatesResponse

  const byDate = new Map<string, number>()
  for (const entry of data.refRates ?? []) {
    if (entry.type === 'SOFRAI' && typeof entry.index === 'number') {
      byDate.set(entry.effectiveDate, entry.index)
    }
  }

  return (indexId: string, date: Date): number => {
    const key = date.toISOString().slice(0, 10)
    const value = byDate.get(key)
    if (value === undefined) {
      throw new Error(
        `NYFed back-fill cache has no SOFRAI entry for ${indexId} @ ${key} ` +
          `(range ${start}..${end}, ${byDate.size} days cached)`,
      )
    }
    return value
  }
}

/**
 * True when any enabled index routes through the `nyfed` projection
 * provider. Used by the oracle bootstrap to decide whether to pay for
 * the one-shot range fetch above.
 */
export function hasNyFedProjectionProvider(config: {
  curves?: { currencies: Record<string, { projection: { provider: string } }> }
  floatingRateIndices?: Record<string, { currency: string }>
}): boolean {
  const indices = config.floatingRateIndices
  const curves = config.curves
  if (!indices || !curves) return false
  for (const idx of Object.values(indices)) {
    if (curves.currencies[idx.currency]?.projection.provider === 'nyfed') {
      return true
    }
  }
  return false
}

/**
 * Build a lookup when config needs one, else return undefined. Logs
 * success + failure via the provided logger. Never throws — failure
 * downgrades to `undefined` so the caller can continue and let the
 * back-fill's per-index `throw` surface individual failures.
 */
export interface BootstrapLogger {
  info(rec: Record<string, unknown>): void
  error(rec: Record<string, unknown>): void
}

export async function bootstrapNyFedRateLookup(opts: {
  config: Parameters<typeof hasNyFedProjectionProvider>[0] & { oracle: { fetchTimeoutMs: number } }
  logger: BootstrapLogger
  windowDays?: number
}): Promise<NyFedRateLookup | undefined> {
  if (!hasNyFedProjectionProvider(opts.config)) return undefined

  const windowDays = opts.windowDays ?? 90
  const asOf = new Date()
  const start = new Date(asOf)
  start.setUTCDate(start.getUTCDate() - windowDays)
  try {
    const lookup = await buildNyFedRateCache({
      startDate: start,
      endDate: asOf,
      timeoutMs: opts.config.oracle.fetchTimeoutMs,
    })
    opts.logger.info({ event: 'nyfed_rate_cache_built', windowDays })
    return lookup
  } catch (err) {
    opts.logger.error({
      event: 'nyfed_rate_cache_failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return undefined
  }
}
