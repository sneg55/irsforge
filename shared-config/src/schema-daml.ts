import { z } from 'zod'

// Daml ledger-claim metadata. `unsafeJwtSecret` is the HS256 key the Canton
// sandbox accepts in its --unsafe-jwt-token mode; it is only meaningful when
// `auth.provider === "demo"`. The /api/config route MUST strip it before
// emitting config to the browser unless the provider is demo.
export const damlSchema = z
  .object({
    ledgerId: z.string().min(1).default('sandbox'),
    applicationId: z.string().min(1).default('IRSForge'),
    unsafeJwtSecret: z.string().min(1).default('secret'),
  })
  .default({})

export const ledgerSchema = z
  .object({
    upstreamTimeoutMs: z.number().int().positive().default(15_000),
  })
  .default({})
