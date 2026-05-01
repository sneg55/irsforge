import { resolve } from 'node:path'
import { loadConfig } from 'irsforge-shared-config'
import { describe, expect, it } from 'vitest'
import { mintDemoSchedulerToken } from '../../../authz/mint-demo-scheduler-token.js'
import { mintDemoOperatorToken } from '../../../authz/mint-demo-token.js'
import { createLedgerClient } from '../../../authz/operator-token.js'
import {
  MATURED_SWAP_TEMPLATE_ID,
  SWAP_WORKFLOW_TEMPLATE_ID,
} from '../../../shared/template-ids.js'
import { SchedulerService } from '../index.js'
import { discoverSetup } from '../setup-discovery.js'

/**
 * Sandbox-gated scheduler-service integration test. Skipped in CI /
 * regular `npm test` runs; opt in via `IRSFORGE_SANDBOX_RUNNING=1` after
 * `make demo` (or use `make test-scheduler-e2e`).
 *
 * What this proves:
 *   1. The scheduler JWT the oracle mints is accepted by Canton.
 *   2. `discoverSetup` resolves every plumbing cid from CashSetupRecord
 *      (scheduler LifecycleRule, settlement factory, event factory,
 *      route provider, default currency instrument key, both party
 *      account keys). Any missing field fails loudly at boot rather
 *      than mid-tick.
 *   3. A full tick cycle (trigger → settle-net → mature) completes with
 *      zero integration errors against the live ledger — catches the
 *      common regressions (template ID drift, package rebuild mismatch,
 *      schema changes that break the per-tick ledger queries).
 *   4. The scheduler is aware of the demo's Active SwapWorkflows, so the
 *      mature candidate set is non-empty. Instrument-level retirement
 *      (the "no clicks" claim) needs DemoSeed augmentation so a
 *      past-maturity proposal is auto-accepted AND the oracle's 90-day
 *      observation back-fill covers the accrual window — tracked as a
 *      Phase 7+ follow-up (see specs/followups.md).
 *
 * Re-running this against an already-matured sandbox is safe: all
 * assertions are monotone (≥ 0, error count == 0), not exactly-one.
 */

interface MaturedSwapRow {
  contractId: string
  payload: {
    swapType: string
    instrumentKey: { id: { unpack: string } }
  }
}

interface SwapWorkflowRow {
  contractId: string
  payload: {
    swapType: string
    instrumentKey: { id: { unpack: string } }
  }
}

describe.skipIf(process.env['IRSFORGE_SANDBOX_RUNNING'] !== '1')(
  'scheduler end-to-end (sandbox)',
  () => {
    it('runs a full tick cycle against the live sandbox without integration errors', async () => {
      // Share the YAML with `make demo` so party hints and JWT claims
      // match what the running sandbox minted.
      const configPath =
        process.env['IRSFORGE_CONFIG_PATH'] ?? resolve(process.cwd(), '../irsforge.yaml')
      const config = loadConfig(configPath)

      // Read client via operator JWT: operator observes every
      // swap-related contract and sees MaturedSwap.
      const operatorToken = await mintDemoOperatorToken(config)
      expect(
        operatorToken,
        'mintDemoOperatorToken returned null — is Canton up and Operator allocated? Run `make demo` first.',
      ).not.toBeNull()
      const readClient = createLedgerClient(operatorToken!, config.oracle.ledgerTimeoutMs)

      // Write path uses the Scheduler JWT — tests the Phase 6 Stage C1
      // dual-lifecycle-rule wiring: the scheduler should be able to
      // drive Evolve without impersonating operator.
      const schedulerToken = await mintDemoSchedulerToken(config)
      expect(
        schedulerToken,
        'mintDemoSchedulerToken returned null — Scheduler party not allocated.',
      ).not.toBeNull()
      const schedulerClient = createLedgerClient(schedulerToken!, config.oracle.ledgerTimeoutMs)

      // (2) — every field here must be populated; discoverSetup throws
      // loudly on missing CashSetupRecord fields.
      const setup = await discoverSetup(schedulerClient)
      expect(setup.schedulerLifecycleRuleCid).toMatch(/^[0-9a-f]+$/)
      expect(setup.settlementFactoryCid).toMatch(/^[0-9a-f]+$/)
      expect(setup.routeProviderCid).toMatch(/^[0-9a-f]+$/)
      expect(setup.eventFactoryCid).toMatch(/^[0-9a-f]+$/)
      expect(setup.defaultCurrencyInstrumentKey).toBeDefined()
      expect(setup.partyAAccountKey).toBeDefined()
      expect(setup.partyBAccountKey).toBeDefined()

      // (4) — confirm the demo seeded at least one Active SwapWorkflow
      // for the scheduler to consider. A completely empty workflow set
      // means the seed is broken and the tick cycle is vacuously clean.
      const workflows = (await readClient.query(SWAP_WORKFLOW_TEMPLATE_ID)) as SwapWorkflowRow[]
      expect(
        workflows.length,
        'No SwapWorkflow on ledger — demo seed did not run or is broken.',
      ).toBeGreaterThan(0)

      // (3) — drive one full tick cycle in the order the cron fires.
      // The per-tick LifecycleRule rewrite in Stage C1 means trigger
      // and settleNet under the Scheduler JWT alone must round-trip
      // cleanly; any auth regression surfaces as a Canton error here.
      const scheduler = new SchedulerService(
        schedulerClient,
        {
          cron: {
            trigger: '*/1 * * * * *',
            settleNet: '*/1 * * * * *',
            mature: '*/1 * * * * *',
          },
        },
        setup,
      )
      const triggerResult = await scheduler.triggerTick()
      const settleResult = await scheduler.settleNetTick()
      const matureResult = await scheduler.matureTick()

      expect(triggerResult.errors, 'trigger tick had integration errors').toEqual([])
      expect(settleResult.errors, 'settleNet tick had integration errors').toEqual([])
      expect(matureResult.errors, 'mature tick had integration errors').toEqual([])

      // `skipped` counting instruments the scheduler examined and
      // chose not to act on — should equal the workflow count for a
      // healthy sandbox (every instrument evaluated). `fired` can be
      // 0 or positive depending on the current moment in the coupon
      // schedule.
      expect(matureResult.fired + matureResult.skipped).toBeGreaterThanOrEqual(workflows.length)

      // MaturedSwap query must at minimum resolve. Shape-check any
      // returned rows: if the demo is later augmented to auto-accept
      // a past-maturity proposal (see docstring note 4), this assert
      // tightens into a real retirement check for free.
      const matured = (await readClient.query(MATURED_SWAP_TEMPLATE_ID)) as MaturedSwapRow[]
      for (const m of matured) {
        expect(typeof m.payload.swapType).toBe('string')
        expect(m.payload.instrumentKey.id.unpack).toEqual(expect.any(String))
      }
    }, 60_000)
  },
)
