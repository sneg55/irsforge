/**
 * Bootstrap helpers that wire `publishDailyWindow` to the live Canton ledger
 * across every registered oracle provider.
 *
 * Why split from `daily-publisher.ts`:
 *   `daily-publisher.ts` is a pure scheduling/idempotency module with no
 *   ledger awareness. This file is the impure adapter that translates that
 *   abstract contract into actual `LedgerClient` calls (Daml Finance
 *   `Observation` queries + `Provider_PublishRate` interface choice
 *   exercises).
 *
 * Provider dispatch:
 *   Indices are bucketed by the registered provider id read off
 *   `curves.currencies[ccy].projection.provider`. The provider supplies a
 *   `rateSource` (back-fill data) and an optional `onPublishedDaily` hook
 *   (post-publish side effects, e.g. caching the latest overnight rate).
 *   New providers register an `OracleProvider` in `oracle/src/index.ts`;
 *   no edits to this file are needed.
 */

import type { Config } from 'irsforge-shared-config'
import type { LedgerClient } from '../shared/ledger-client.js'
import type { Logger } from '../shared/logger.js'
import type { State } from '../shared/state.js'
import { DAML_FINANCE_OBSERVATION_TEMPLATE_ID } from '../shared/template-ids.js'
import { getConcreteTemplateId } from './concrete-template-ids.js'
import {
  type DailyObservation,
  type DailyPublisherLedger,
  publishDailyWindow,
} from './daily-publisher.js'
import { exerciseProviderChoice } from './onchain-publisher.js'
import { getProvider } from './registry.js'

const DEFAULT_WINDOW_DAYS = 90

export interface DailyBootstrapDeps {
  client: LedgerClient
  config: Config
  logger: Logger
  /** Override for testing; defaults to `new Date()`. */
  asOf?: Date
  /** Override for testing; defaults to {@link DEFAULT_WINDOW_DAYS}. */
  windowDays?: number
  /**
   * Optional in-memory state cache. Threaded into each provider's
   * `onPublishedDaily` hook so demo providers can record their latest
   * overnight rate into the shared health-status state.
   */
  state?: State
}

/**
 * Run a single 90-day back-fill across every enabled `floatingRateIndices`
 * entry. Per-index, the curve provider in `config.curves.currencies[ccy]
 * .projection.provider` decides which on-chain provider mints the
 * observations.
 *
 * Idempotent: pre-existing (indexId, date) observations are skipped.
 */
export async function publishDailyWindowsForAllIndices(deps: DailyBootstrapDeps): Promise<void> {
  const indices = deps.config.floatingRateIndices
  if (!indices) return
  const curves = deps.config.curves
  if (!curves) return

  const asOf = deps.asOf ?? new Date()
  const windowDays = deps.windowDays ?? DEFAULT_WINDOW_DAYS

  // Bucket indices by registered provider id (read off the projection
  // provider per currency).
  const buckets = new Map<string, string[]>()
  for (const [indexId, idx] of Object.entries(indices)) {
    const ccy = idx.currency
    const providerId = curves.currencies[ccy]?.projection.provider
    if (!providerId) {
      deps.logger.warn({
        event: 'daily_publish_skip',
        indexId,
        reason: `no projection provider configured for ${ccy}`,
      })
      continue
    }
    const list = buckets.get(providerId) ?? []
    list.push(indexId)
    buckets.set(providerId, list)
  }

  for (const [providerId, indexIds] of buckets) {
    // Defense in depth: schema validation (Task 11) ensures every
    // referenced provider id is registered, but a registry miss here
    // would otherwise silently no-op the bucket.
    const provider = getProvider(providerId)
    const ledger = await buildAdapter(deps.client, providerId)
    if (!ledger) {
      deps.logger.warn({
        event: 'daily_publish_provider_missing',
        provider: providerId,
      })
      continue
    }
    const rateSource =
      provider.rateSource ?? ((indexId: string, _d: Date) => stubRateFallback(indexId, deps.config))
    await publishDailyWindow({
      ledger,
      rateSource,
      indexIds,
      asOf,
      windowDays,
    })
    deps.logger.info({
      event: 'daily_publish_complete',
      provider: providerId,
      indexIds,
      windowDays,
    })
    provider.onPublishedDaily?.(indexIds, asOf, windowDays, {
      state: deps.state,
      config: deps.config,
    })
  }
}

async function buildAdapter(
  client: LedgerClient,
  providerId: string,
): Promise<DailyPublisherLedger | null> {
  const concreteTemplateId = getConcreteTemplateId(providerId)
  const provider = getProvider(providerId)
  const providers = await client.query(concreteTemplateId)
  if (providers.length === 0) return null
  const providerCid = (providers[0] as { contractId: string }).contractId

  return {
    async listObservations(indexId: string): Promise<DailyObservation[]> {
      const rows = await client.query(DAML_FINANCE_OBSERVATION_TEMPLATE_ID, {
        id: { unpack: indexId },
      })
      // The Observation template stores a Map<Time, Decimal> — we flatten
      // into one DailyObservation per (id, time) so the publisher's
      // idempotency keying can match individual dates.
      return rows.flatMap((row) => {
        const payload = (row as { payload?: ObservationPayload }).payload
        const entries = payload?.observations ?? []
        return entries.map(([t, v]) => ({
          indexId,
          date: new Date(t),
          rate: typeof v === 'string' ? parseFloat(v) : v,
        }))
      })
    },
    async createObservation(indexId: string, date: Date, rate: number): Promise<void> {
      await exerciseProviderChoice(client, {
        interfaceTemplateId: provider.onchainInterfaceTemplateId,
        contractId: providerCid,
        choice: 'Provider_PublishRate',
        argument: {
          args: {
            rateId: indexId,
            effectiveDate: date.toISOString().slice(0, 10),
            value: rate.toString(),
          },
        },
      })
    },
  }
}

/**
 * Last-resort rate source when a registered provider doesn't supply one.
 * Reads the projection pillar's `zeroRate` from `demo.stubCurves`. Returns
 * 0 when nothing is configured — for the demo profile this just means the
 * back-fill writes flat zeros, which is loud enough to debug locally and
 * harmless because the seed step writes the real stub curve right after.
 */
function stubRateFallback(indexId: string, config: Config): number {
  const idx = config.floatingRateIndices?.[indexId]
  if (!idx) return 0
  const stubCurve = config.demo?.stubCurves?.[idx.currency]
  const overnight = stubCurve?.projections?.[indexId]?.pillars[0]?.zeroRate
  return overnight ?? 0
}

interface ObservationPayload {
  observations?: [string, string | number][]
}
