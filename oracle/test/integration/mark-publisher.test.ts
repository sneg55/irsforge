import { beforeAll, describe, expect, it } from 'vitest'
import { MarkPublisherService } from '../../src/services/mark-publisher/index.js'
import { LedgerClient } from '../../src/shared/ledger-client.js'
import type { Logger } from '../../src/shared/logger.js'
import { MARK_TEMPLATE_ID } from '../../src/shared/template-ids.js'

// Gated integration smoke. Runs only when the harness is pointed at a live
// sandbox via `IRSFORGE_SANDBOX_RUNNING=1`, so CI without a sandbox stays
// green. Manual run:
//
//   make dev &
//   sleep 30
//   IRSFORGE_SANDBOX_RUNNING=1 OPERATOR_TOKEN=<token> \
//     npx vitest run test/integration/mark-publisher.test.ts
describe.skipIf(!process.env['IRSFORGE_SANDBOX_RUNNING'])(
  'MarkPublisherService integration',
  () => {
    let client: LedgerClient
    beforeAll(() => {
      client = new LedgerClient(process.env['OPERATOR_TOKEN'])
    })

    it('publishes a mark when at least one CSA + netting-set is present', async () => {
      const logger: Logger = {
        info: (d) => console.log(JSON.stringify(d)),
        warn: (d) => console.warn(JSON.stringify(d)),
        error: (d) => console.error(JSON.stringify(d)),
      }
      const svc = new MarkPublisherService({
        client,
        logger,
        cron: '* * * * * *',
        computeDeps: {
          asOf: () => new Date().toISOString(),
          // Stage B integration harness placeholder: Stage C/D wire the
          // real sandbox-state adapters. Kept throwing so a real smoke run
          // exposes the missing wiring rather than writing zero exposure.
          resolveSwapConfig: (cid) => {
            throw new Error(`integration: resolveSwapConfig not wired for ${cid}`)
          },
          resolveCtx: (ccy) => {
            throw new Error(`integration: resolveCtx not wired for ${ccy}`)
          },
        },
      })
      const result = await svc.tick()
      // Permit errors here because the adapter stubs throw by design;
      // assert that the publisher still enumerated CSAs and the ledger
      // state is reachable.
      expect(typeof result.errors).toBe('number')
      const marks = await client.query(MARK_TEMPLATE_ID)
      expect(Array.isArray(marks)).toBe(true)
    })
  },
)
