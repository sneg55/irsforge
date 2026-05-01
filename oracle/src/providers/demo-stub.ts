/**
 * DemoStubOracleProvider — registered OracleProvider that backs the
 * `demo-stub` provider id in YAML configs.
 *
 * Sourced from `demo.stubCurves` in the shared config: every floating-rate
 * index resolves its rate from the projection pillar's `zeroRate` for its
 * currency. Used by `daily-publisher-bootstrap` for the back-fill rate
 * source and by `seedCurves` to mint initial Discount/Projection curves.
 *
 * The post-publish `onPublishedDaily` hook records the latest USD
 * projection overnight rate into shared `state` so /api/oracle/health's
 * status footer has something fresh to display in demo mode (mirrors
 * what `NyFedSofrService.fetchAndBuildCurve` does for live mode).
 */
import type { Config } from 'irsforge-shared-config'
import { IRSFORGE_PROVIDER_INTERFACE_ID } from '../shared/generated/package-ids.js'
import type { State } from '../shared/state.js'
import type { OracleProvider, RateObservation } from './types.js'

export function buildDemoStubProvider(config: Config): OracleProvider {
  const supportedRateIds = collectSupportedIds(config)
  return {
    id: 'demo-stub',
    supportedRateIds,
    onchainInterfaceTemplateId: IRSFORGE_PROVIDER_INTERFACE_ID,
    fetchRate(rateId: string, date: string): Promise<RateObservation> {
      return Promise.resolve({ rateId, effectiveDate: date, value: stubRate(rateId, config) })
    },
    rateSource: (indexId: string, _d: Date) => stubRate(indexId, config),
    onPublishedDaily(indexIds, asOf, _windowDays, deps) {
      recordUsdOvernightToState(deps, indexIds, asOf)
    },
  }
}

function stubRate(indexId: string, config: Config): number {
  const idx = config.floatingRateIndices?.[indexId]
  if (!idx) return 0
  const stubCurve = config.demo?.stubCurves?.[idx.currency]
  const overnight = stubCurve?.projections?.[indexId]?.pillars[0]?.zeroRate
  return overnight ?? 0
}

function collectSupportedIds(config: Config): string[] {
  const indices = config.floatingRateIndices ?? {}
  return Object.keys(indices)
}

function recordUsdOvernightToState(
  deps: {
    state?: Pick<State, 'recordObservation' | 'recordOvernightRate'>
    config: {
      curves?: { currencies: Record<string, { projection: { indexId: string } }> }
      demo?: {
        stubCurves?: Record<
          string,
          { projections?: Record<string, { pillars: { zeroRate: number }[] }> }
        >
      }
    }
  },
  indexIds: string[],
  asOf: Date,
): void {
  if (!deps.state) return
  const usdIndexId = deps.config.curves?.currencies['USD']?.projection.indexId
  if (!usdIndexId || !indexIds.includes(usdIndexId)) return
  const decimal =
    deps.config.demo?.stubCurves?.['USD']?.projections?.[usdIndexId]?.pillars[0]?.zeroRate ?? 0
  const latest = new Date(asOf)
  latest.setUTCDate(latest.getUTCDate() - 1)
  const effectiveDate = latest.toISOString().slice(0, 10)
  deps.state.recordObservation(usdIndexId, effectiveDate, decimal)
  deps.state.recordOvernightRate(effectiveDate, decimal * 100)
}
