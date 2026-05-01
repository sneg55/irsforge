import { Cron } from 'croner'
import type { LedgerClient } from '../../shared/ledger-client.js'
import type { Logger } from '../../shared/logger.js'
import { matureTick } from './mature.js'
import { settleNetTick } from './settle-net.js'
import type { SetupDiscovery } from './setup-discovery.js'
import { triggerLifecycleTick } from './trigger-lifecycle.js'

export type { SetupDiscovery } from './setup-discovery.js'

export interface SchedulerConfig {
  cron: { trigger: string; settleNet: string; mature: string }
}

export interface TickResult {
  fired: number
  skipped: number
  errors: Array<{ context: string; error: string }>
}

export class SchedulerService {
  constructor(
    private readonly client: LedgerClient,
    private readonly config: SchedulerConfig,
    private readonly setup: SetupDiscovery,
    private readonly logger?: Logger,
  ) {}

  /**
   * Register the three croner crons. Each cron fires its tick
   * independently — the three crons are not globally serialised —
   * because production deployments may want different cadences for each
   * (trigger fast, settle-net fast, mature slow). Tests that rely on
   * ordering call `runFullTick` directly.
   *
   * Returns the created crons so the caller can stop() them on process
   * shutdown.
   */
  start(): Cron[] {
    return [
      new Cron(this.config.cron.trigger, () => void this.runAndLog('trigger')),
      new Cron(this.config.cron.settleNet, () => void this.runAndLog('settleNet')),
      new Cron(this.config.cron.mature, () => void this.runAndLog('mature')),
    ]
  }

  async triggerTick(): Promise<TickResult> {
    return await triggerLifecycleTick(this.client, new Date(), this.setup)
  }

  async settleNetTick(): Promise<TickResult> {
    return await settleNetTick(this.client, new Date(), this.setup)
  }

  async matureTick(): Promise<TickResult> {
    return await matureTick(this.client, new Date(), this.setup)
  }

  private async runAndLog(kind: 'trigger' | 'settleNet' | 'mature'): Promise<void> {
    try {
      const result =
        kind === 'trigger'
          ? await this.triggerTick()
          : kind === 'settleNet'
            ? await this.settleNetTick()
            : await this.matureTick()
      this.logger?.info({
        event: `scheduler_${kind}_tick`,
        fired: result.fired,
        skipped: result.skipped,
        errors: result.errors.length,
        errorSamples: result.errors.slice(0, 3),
      })
    } catch (err) {
      this.logger?.error({
        event: `scheduler_${kind}_tick_failed`,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
