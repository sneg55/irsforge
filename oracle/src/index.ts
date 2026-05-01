import { resolve } from 'node:path'
import { Cron } from 'croner'
import { loadConfig } from 'irsforge-shared-config'
import { createHttpServer } from './api/server.js'
import { createLedgerClient } from './authz/operator-token.js'
import { resolveQualifiedParties } from './authz/resolve-parties.js'
import { resolveServiceToken, type ServiceTokenHandle } from './authz/service-token.js'
import { registerAllProviders, setNyFedRateLookup } from './providers/bootstrap-registrations.js'
import { publishDailyWindowsForAllIndices } from './providers/daily-publisher-bootstrap.js'
import { fetchSofrData } from './providers/nyfed/fetcher.js'
import { bootstrapNyFedRateLookup } from './providers/nyfed/rate-cache.js'
import { listProviders, validateProviderRefs } from './providers/registry.js'
import { Scheduler } from './scheduler/scheduler.js'
import { fxSpotLedgerAdapter, seedCurves, seedFxSpots, seedIndices } from './seed/index.js'
import { DemoCurveTicker } from './services/demo-curve-ticker.js'
import { LedgerPublisher } from './services/ledger-publisher.js'
import { MarkPublisherService } from './services/mark-publisher/index.js'
import { resolveSwapConfig } from './services/mark-publisher/replay.js'
import { SchedulerService } from './services/scheduler/index.js'
import { discoverSetup } from './services/scheduler/setup-discovery.js'
import { NyFedSofrService } from './services/sofr-service.js'
import { ENV } from './shared/env.js'
import { IRSFORGE_PROVIDER_INTERFACE_ID } from './shared/generated/package-ids.js'
import { createLogger } from './shared/logger.js'
import { state } from './shared/state.js'

const DEMO_PORT = 3001

// Load shared config — product enablement and CDS reference names live here
// rather than hardcoded so a new participant can toggle products / add names
// in YAML without touching source.
const configPath = process.env['IRSFORGE_CONFIG_PATH'] ?? resolve(process.cwd(), '../irsforge.yaml')
const sharedConfig = loadConfig(configPath)

// Register every built-in OracleProvider (nyfed / demo-stub / cds-stub)
// before main() runs. Subsequent dispatch (daily-publisher-bootstrap,
// seedCurves, demo-curve-ticker) reads from the registry; the registration
// site is the single extension point for adding a new provider.
registerAllProviders({ config: sharedConfig, state })

// Fail fast if any curves.currencies.*.{discount,projection}.provider in
// the YAML doesn't resolve to a registered OracleProvider. Surfaces the
// precise (ccy, curveType, id) tuple plus the registered set so the
// operator can either register a new provider or fix the YAML — long
// before main() opens HTTP/seed/scheduler. Schema only validates the id
// *shape* (lowercase-hyphenated string); registration is the runtime
// contract enforced here.
const registeredIds = new Set<string>(listProviders().map((p) => p.id))
const refErrors = validateProviderRefs(sharedConfig, registeredIds)
if (refErrors.length > 0) {
  for (const e of refErrors) {
    console.error(
      `oracle.config.invalid: provider '${e.providerId}' referenced in curves.currencies.${e.ccy}.${e.curveType} is not registered. Register an OracleProvider in oracle/src/index.ts or set provider to one of: ${[...registeredIds].sort().join(', ')}.`,
    )
  }
  process.exit(1)
}

 
async function main(): Promise<void> {
  const mode = ENV.MODE()
  const logger = createLogger()
  logger.info({ event: 'oracle_starting', mode })

  const sofrService = new NyFedSofrService({
    fetcher: (date) => fetchSofrData(date, sharedConfig.oracle.fetchTimeoutMs),
    state,
  })

  // Mark-publisher service-account token. `resolveServiceToken` dispatches:
  //   SERVICE_TOKEN_MARK_PUBLISHER env → demo HS256 mint → OAuth2 client-credentials.
  // OPERATOR_TOKEN is the legacy alias for mark-publisher (see service-token.ts).
  const operatorHandle = await resolveServiceToken('mark-publisher', sharedConfig)
  logger.info({ event: 'service_token_acquired', accountId: 'mark-publisher' })
  const operatorToken = await operatorHandle.getToken()
  const ledgerClient = createLedgerClient(
    operatorHandle.getToken,
    sharedConfig.oracle.ledgerTimeoutMs,
  )
  const ledgerPublisher = new LedgerPublisher(ledgerClient, IRSFORGE_PROVIDER_INTERFACE_ID)

  // Seed on-chain FloatingRateIndex + Curve contracts before accepting traffic.
  // Hard cutover: the HTTP server does not open until seeding completes so
  // downstream (frontend, tests) never see a partially-seeded ledger.
  await seedIndices(ledgerClient, sharedConfig)
  await seedCurves(ledgerClient, sharedConfig)
  // XCCY reporting-ccy NPV translation reads FxSpot contracts from the
  // ledger. In demo profile, seed them from `demo.fxSpots`. Absent block =
  // no-op (no XCCY trades possible until fxSpots are configured).
  // FxSpot.operator is the template signatory and must match the qualified
  // party id in actAs — resolve via /v1/parties before constructing the
  // adapter.
  if (operatorToken && sharedConfig.demo?.fxSpots) {
    const parties = await resolveQualifiedParties(operatorToken)
    if (parties) {
      await seedFxSpots(fxSpotLedgerAdapter(ledgerClient, parties), sharedConfig.demo.fxSpots)
    } else {
      logger.error({ event: 'seed_fx_spot_skip_unresolved_parties' })
    }
  }
  logger.info({ event: 'seed_complete' })

  // Demo-only ticker that re-publishes seeded stub curves with a small
  // random perturbation so the blotter's Trend sparkline accumulates
  // history. PublishDiscountCurve archives the prior Curve contract on
  // each create, so the ACS holds exactly one point per key — without
  // this loop useCurveStream collapses the sparkline to a dot.
  const demoCurveTicker = new DemoCurveTicker({
    client: ledgerClient,
    config: sharedConfig,
    logger,
    state,
  })
  demoCurveTicker.start()

  // Back-fill 90 days of daily Observations for every enabled
  // floatingRateIndices entry. Idempotent against existing observations.
  // The NYFed cache is wired into the registered nyfed provider's
  // rateSource closure via setNyFedRateLookup so the bootstrap function
  // signature stays provider-agnostic.
  try {
    const lookup = await bootstrapNyFedRateLookup({
      config: sharedConfig,
      logger,
    })
    setNyFedRateLookup(lookup)
    await publishDailyWindowsForAllIndices({
      client: ledgerClient,
      config: sharedConfig,
      logger,
      state,
    })
  } catch (err) {
    logger.error({
      event: 'daily_publish_bootstrap_failed',
      error: err instanceof Error ? err.message : String(err),
    })
  }

  const server = createHttpServer({ mode, sofrService, ledgerPublisher })
  server.listen(DEMO_PORT, () => {
    logger.info({ event: 'http_listening', port: DEMO_PORT, mode })
  })

  // Phase 5 Stage B/D — CSA mark publisher loop.
  //
  // computeDeps now use the same replay adapters the harness uses
  // (services/mark-publisher/replay.ts), so the publisher's mark and the
  // Stage D harness's direct shared-pricing compute traverse on-chain
  // state identically — one source of truth for "on-chain → PricingContext
  // / SwapConfig → pricingEngine.price()".
  const markPublisher = new MarkPublisherService({
    client: ledgerClient,
    logger,
    cron: ENV.MARK_PUBLISHER_CRON(),
    computeDeps: {
      asOf: () => new Date().toISOString(),
      resolveSwapConfig: (cid) => resolveSwapConfig(ledgerClient, cid),
      // tick() owns ctx construction so the on-chain snapshot it writes
      // references the exact curve/index set used to compute the mark.
      // resolveCtx here is a defensive throw — if tick() ever stops
      // overriding it, the failure surfaces loudly instead of silently
      // computing against a different snapshot.
      resolveCtx: () => {
        throw new Error(
          'MarkPublisherService.tick() should override resolveCtx; this stub means a regression.',
        )
      },
    },
  })
  const markCron = new Cron(ENV.MARK_PUBLISHER_CRON(), () => {
    void markPublisher
      .tick()
      .then((r) => logger.info({ event: 'mark_tick', ...r }))
      .catch((err) =>
        logger.error({
          event: 'mark_tick_failed',
          error: err instanceof Error ? err.message : String(err),
        }),
      )
  })
  logger.info({
    event: 'mark_publisher_started',
    cron: ENV.MARK_PUBLISHER_CRON(),
    nextRun: markCron.nextRun()?.toISOString() ?? null,
  })

  // Phase 6 Stage C2 — off-chain lifecycle / settle-net / mature scheduler.
  // Gated on `scheduler.enabled` (YAML). Uses its own JWT (actAs=[Scheduler])
  // resolved via resolveServiceToken; operator-authority for the Evolve body
  // flows from the scheduler-lifecycler LifecycleRule (Stage C1) discovered
  // via CashSetupRecord.schedulerLifecycleRuleCid.
  let schedulerCrons: Cron[] = []
  let schedulerHandle: ServiceTokenHandle | null = null
  if (sharedConfig.scheduler.enabled) {
    try {
      schedulerHandle = await resolveServiceToken('scheduler', sharedConfig)
      logger.info({ event: 'service_token_acquired', accountId: 'scheduler' })
    } catch (err) {
      logger.error({
        event: 'service_token_acquire_failed',
        accountId: 'scheduler',
        error: err instanceof Error ? err.message : String(err),
        hint: 'check SERVICE_CLIENT_SECRET_SCHEDULER for builtin/oidc, or Scheduler party allocation in demo',
      })
    }
    if (schedulerHandle) {
      const schedulerClient = createLedgerClient(
        schedulerHandle.getToken,
        sharedConfig.oracle.ledgerTimeoutMs,
      )
      try {
        const setup = await discoverSetup(schedulerClient)
        const schedulerService = new SchedulerService(
          schedulerClient,
          { cron: sharedConfig.scheduler.cron },
          setup,
          logger,
        )
        schedulerCrons = schedulerService.start()
        logger.info({
          event: 'scheduler_service_started',
          cron: sharedConfig.scheduler.cron,
        })
      } catch (err) {
        logger.error({
          event: 'scheduler_service_start_failed',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  if (mode === 'live') {
    const scheduler = new Scheduler({
      cron: ENV.SCHEDULE_CRON(),
      timezone: ENV.SCHEDULE_TZ(),
      sofrService,
      ledgerPublisher,
      state,
      logger,
    })
    scheduler.start()

    const shutdown = async (signal: string): Promise<void> => {
      logger.info({ event: 'shutdown_begin', signal })
      await new Promise<void>((r) => server.close(() => r()))
      markCron.stop()
      schedulerCrons.forEach((c) => c.stop())
      operatorHandle.stop()
      schedulerHandle?.stop()
      demoCurveTicker.stop()
      await scheduler.stop()
      logger.info({ event: 'shutdown_complete' })
      process.exit(0)
    }
    process.on('SIGTERM', () => void shutdown('SIGTERM'))
    process.on('SIGINT', () => void shutdown('SIGINT'))
  }
}

main().catch((err: unknown) => {
  console.error(
    JSON.stringify({
      level: 'error',
      ts: new Date().toISOString(),
      event: 'fatal',
      error: err instanceof Error ? err.message : String(err),
    }),
  )
  process.exit(1)
})
