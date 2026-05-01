import { Cron } from 'croner'
import { curvePointsToPillars } from '../providers/nyfed/curve-builder.js'
import type { LedgerPublisher } from '../services/ledger-publisher.js'
import type { SofrService } from '../services/sofr-service.js'
import type { Logger } from '../shared/logger.js'
import type { State } from '../shared/state.js'
import { type RetryOpts, withRetry } from './retry.js'

export interface SchedulerDeps {
  cron: string
  timezone: string
  sofrService: SofrService
  ledgerPublisher: LedgerPublisher
  state: State
  logger: Logger
  /** Override retry policy; default: 3 attempts, 2s base, 20% jitter. */
  retry?: RetryOpts
}

const DEFAULT_RETRY: RetryOpts = { attempts: 3, baseMs: 2000, jitter: 0.2 }

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

export class Scheduler {
  private job: Cron | null = null
  private inflight: Promise<void> = Promise.resolve()

  constructor(private readonly deps: SchedulerDeps) {}

  start(): void {
    this.job = new Cron(this.deps.cron, { timezone: this.deps.timezone }, () => this.tick())
    this.deps.state.nextScheduledRun = this.job.nextRun()?.toISOString() ?? null
    this.deps.logger.info({
      event: 'scheduler_started',
      cron: this.deps.cron,
      timezone: this.deps.timezone,
      nextRun: this.deps.state.nextScheduledRun,
    })
  }

  async stop(): Promise<void> {
    this.job?.stop()
    this.job = null
    await this.inflight
  }

  private tick(): void {
    this.inflight = this.runOnce().finally(() => {
      this.deps.state.nextScheduledRun = this.job?.nextRun()?.toISOString() ?? null
    })
  }

  private async runOnce(): Promise<void> {
    const today = todayIso()
    const opts = this.deps.retry ?? DEFAULT_RETRY
    try {
      await withRetry(async () => {
        const curve = await this.deps.sofrService.fetchAndBuildCurve(today)
        const result = await this.deps.ledgerPublisher.publishCurve(today, curve)

        // Also upsert the on-chain Oracle.Curve contracts that the
        // frontend pricer reads directly. Before this fix, Phase 1 debt
        // #1 left USD discount / projection curves unpublished: seedCurves
        // intentionally skips nyfed-provider currencies (they need real
        // market data, not stub values) and runOnce used to publish only
        // the legacy per-tenor Observations. Result: after startup,
        // useCurve('USD','Discount') returned null until an admin hit
        // /api/publish-curve (which was broken by the SOFRAI validator
        // bug — see the separate fix).
        const pillars = curvePointsToPillars(curve)
        const asOf = new Date(today).toISOString()
        await this.deps.ledgerPublisher.publishDiscountCurve(
          'USD',
          asOf,
          pillars,
          'LinearZero',
          'Act360',
        )
        await this.deps.ledgerPublisher.publishProjectionCurve(
          'USD-SOFR',
          'USD',
          asOf,
          pillars,
          'LinearZero',
          'Act360',
        )

        this.deps.state.lastSuccessfulPublish = {
          effectiveDate: today,
          publishedAt: new Date().toISOString(),
          tenors: result.count,
          skipped: result.skipped,
        }
        this.deps.state.lastPublishError = null
        this.deps.logger.info({
          event: 'publish_success',
          effectiveDate: today,
          tenors: result.count,
          skipped: result.skipped,
          curveContracts: ['USD-Discount', 'USD-SOFR-Projection'],
        })
      }, opts)
    } catch (err) {
      this.deps.state.lastPublishError = {
        effectiveDate: today,
        failedAt: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
      }
      this.deps.logger.error({
        event: 'publish_failed',
        effectiveDate: today,
        error: err instanceof Error ? err.message : String(err),
      })
      // DO NOT rethrow — the cron keeps firing.
    }
  }
}
