import { z } from 'zod'

// Platform-level ledger UI configuration. Gates the on-chain activity page,
// the live toast stack, and the clickable "Connected to Canton" pill.
// Everything is optional with defaults — a config that omits the block
// entirely gets the demo-friendly defaults below.
export const ledgerUiSchema = z
  .object({
    enabled: z.boolean().default(true),
    bufferSize: z.number().int().positive().default(500),
    templateFilter: z
      .object({
        // Empty allow → all templates this JWT can read. Non-empty → only these.
        allow: z.array(z.string()).default([]),
        // Prefix-match denylist. Applied after allow. Default suppresses
        // infrastructural Daml.Finance noise that would otherwise flood the
        // activity stream on every lifecycle tick.
        deny: z
          .array(z.string())
          .default(['Daml.Finance.Holding', 'Daml.Finance.Settlement.Instruction']),
        // Prefix-match "system-generated" list — templates that rotate on
        // every scheduler tick (oracle observations / curve publishes / mark
        // publishes / nettings). Always hidden from toasts, hidden from the
        // ledger page by default with a "Show system events" toggle to flip
        // on. Distinct from `deny` which is unconditional.
        systemPrefixes: z
          .array(z.string())
          .default([
            'Daml.Finance.Data.V4.Numeric.Observation',
            'Oracle.Curve',
            'Oracle.CurveSnapshot',
            'Csa.Csa',
            'Csa.Mark',
            'Csa.Shortfall',
            'Csa.Netting',
          ]),
      })
      .default({}),
    toasts: z
      .object({
        enabled: z.boolean().default(true),
        maxVisible: z.number().int().nonnegative().default(3),
        dismissAfterMs: z.number().int().positive().default(5000),
      })
      .default({}),
    rawPayload: z
      .object({
        enabled: z.boolean().default(true),
      })
      .default({}),
  })
  .default({})

export type LedgerUi = z.infer<typeof ledgerUiSchema>
