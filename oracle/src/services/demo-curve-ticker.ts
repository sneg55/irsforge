import { Cron } from 'croner'
import type { Config } from 'irsforge-shared-config'
import { getConcreteTemplateId } from '../providers/concrete-template-ids.js'
import { IRSFORGE_PROVIDER_INTERFACE_ID } from '../shared/generated/package-ids.js'
import type { LedgerClient } from '../shared/ledger-client.js'
import type { Logger } from '../shared/logger.js'
import type { State } from '../shared/state.js'

// Demo-only ticker that re-publishes the seeded stubCurves with a small
// random perturbation. Without this, Canton's PublishDiscountCurve /
// PublishProjectionCurve choices archive the previous Curve contract on
// each create, so the ACS holds exactly one curve per
// (currency, curveType, indexId) and useCurveStream's history collapses
// to a single point — the blotter's Trend sparkline shows a dot instead
// of a trendline.
//
// Gated on:
//   - sharedConfig.profile === "demo"
//   - sharedConfig.demo.curveTicker.enabled === true
//
// Both checks happen at the wire-up site (oracle/src/index.ts); this
// service trusts that it should run when start() is called.

interface PillarIn {
  tenorDays: number
  zeroRate: number
}

interface PillarOut {
  tenorDays: string
  zeroRate: string
}

export interface DemoCurveTickerDeps {
  client: LedgerClient
  config: Config
  logger: Logger
  /**
   * Optional in-memory state cache. When supplied, each tick records the
   * latest USD projection overnight rate into `state.lastOvernightRate` so
   * the frontend status bar's "SOFR: x.xx%" footer stays fresh in demo
   * mode. Without this, only the boot-time bootstrap writes the rate and
   * the footer flips to "(stale)" after STALE_THRESHOLD_MS.
   */
  state?: State
  /** Override RNG in tests. Returns a number in [0, 1). */
  random?: () => number
  /** Override clock in tests. */
  now?: () => Date
}

export class DemoCurveTicker {
  private job: Cron | null = null
  private providerCid: string | null = null
  private readonly random: () => number
  private readonly now: () => Date

  constructor(private readonly deps: DemoCurveTickerDeps) {
    this.random = deps.random ?? Math.random
    this.now = deps.now ?? (() => new Date())
  }

  start(): void {
    const ticker = this.deps.config.demo?.curveTicker
    if (!ticker?.enabled) return
    this.job = new Cron(ticker.cron, () => {
      void this.tick()
    })
    this.deps.logger.info({
      event: 'demo_curve_ticker_started',
      cron: ticker.cron,
      bpsRange: ticker.bpsRange,
      nextRun: this.job.nextRun()?.toISOString() ?? null,
    })
  }

  stop(): void {
    this.job?.stop()
    this.job = null
  }

  async tick(): Promise<{ published: number; errors: number }> {
    const curves = this.deps.config.curves
    const stubs = this.deps.config.demo?.stubCurves
    const ticker = this.deps.config.demo?.curveTicker
    if (!curves || !stubs || !ticker?.enabled) {
      return { published: 0, errors: 0 }
    }

    const providerCid = await this.resolveProvider()
    if (!providerCid) return { published: 0, errors: 0 }

    const interpolation = curves.interpolation
    const asOf = this.now().toISOString()
    const bpsRange = ticker.bpsRange

    let published = 0
    let errors = 0

    for (const [ccy, ccyCurve] of Object.entries(curves.currencies)) {
      const stub = stubs[ccy]
      if (!stub) continue
      const dayCount = ccyCurve.dayCount

      if (ccyCurve.discount.provider === 'demo-stub') {
        try {
          await this.deps.client.exercise({
            templateId: IRSFORGE_PROVIDER_INTERFACE_ID,
            contractId: providerCid,
            choice: 'Provider_PublishDiscountCurve',
            argument: {
              currency: ccy,
              asOf,
              pillars: this.perturb(stub.discount.pillars, bpsRange),
              interpolation,
              dayCount,
              constructionMetadata: JSON.stringify({ source: 'demo-curve-ticker' }),
            },
          })
          published += 1
        } catch (err) {
          errors += 1
          this.deps.logger.error({
            event: 'demo_curve_ticker_publish_failed',
            ccy,
            curveType: 'Discount',
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      if (ccyCurve.projection.provider === 'demo-stub') {
        // Schema stores projections keyed by indexId (see shared-config
        // schema.ts:160). Seed path mirrors this; the ticker must too,
        // otherwise stub.projection (singular) is undefined and crashes.
        const indexId = ccyCurve.projection.indexId
        const stubProjection = stub.projections?.[indexId]
        if (!stubProjection) {
          this.deps.logger.warn({
            event: 'demo_curve_ticker_skip',
            ccy,
            indexId,
            reason: 'no stub projection pillars for indexId',
          })
          continue
        }
        const projectionPillars = this.perturb(stubProjection.pillars, bpsRange)
        try {
          await this.deps.client.exercise({
            templateId: IRSFORGE_PROVIDER_INTERFACE_ID,
            contractId: providerCid,
            choice: 'Provider_PublishProjectionCurve',
            argument: {
              indexId,
              currency: ccy,
              asOf,
              pillars: projectionPillars,
              interpolation,
              dayCount,
              constructionMetadata: JSON.stringify({ source: 'demo-curve-ticker' }),
            },
          })
          published += 1
          this.recordOvernightState(indexId, projectionPillars, asOf)
        } catch (err) {
          errors += 1
          this.deps.logger.error({
            event: 'demo_curve_ticker_publish_failed',
            ccy,
            curveType: 'Projection',
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    this.deps.logger.info({ event: 'demo_curve_ticker_tick', asOf, published, errors })
    return { published, errors }
  }

  // Mirror `recordUsdOvernightToState` in daily-publisher-bootstrap.ts: write
  // the (perturbed) USD projection overnight pillar into the shared State so
  // /api/oracle/health's `lastOvernightRate.fetchedAt` advances on every
  // tick. effectiveDate = asOf - 1 day matches the bootstrap convention so
  // the health payload stays consistent between boot and tick.
  private recordOvernightState(indexId: string, pillars: PillarOut[], asOfIso: string): void {
    if (!this.deps.state) return
    const usdIndexId = this.deps.config.curves?.currencies.USD?.projection.indexId
    if (!usdIndexId || indexId !== usdIndexId) return
    const overnight = pillars[0]
    if (!overnight) return
    const decimal = parseFloat(overnight.zeroRate)
    if (!Number.isFinite(decimal)) return
    const d = new Date(asOfIso)
    d.setUTCDate(d.getUTCDate() - 1)
    const effectiveDate = d.toISOString().slice(0, 10)
    this.deps.state.recordObservation(indexId, effectiveDate, decimal)
    this.deps.state.recordOvernightRate(effectiveDate, decimal * 100)
  }

  private perturb(pillars: PillarIn[], bpsRange: number): PillarOut[] {
    const oneBp = 1e-4
    return pillars.map((p) => {
      const delta = (this.random() * 2 - 1) * bpsRange * oneBp
      return {
        tenorDays: p.tenorDays.toString(),
        zeroRate: (p.zeroRate + delta).toFixed(8),
      }
    })
  }

  private async resolveProvider(): Promise<string | null> {
    if (this.providerCid) return this.providerCid
    try {
      const providers = await this.deps.client.query(getConcreteTemplateId('demo-stub'))
      if (providers.length === 0) {
        this.deps.logger.warn({ event: 'demo_curve_ticker_no_provider' })
        return null
      }
      this.providerCid = (providers[0] as { contractId: string }).contractId
      return this.providerCid
    } catch (err) {
      this.deps.logger.error({
        event: 'demo_curve_ticker_provider_query_failed',
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }
}
