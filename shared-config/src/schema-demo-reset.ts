import { z } from 'zod'

// Coordinates a shared-deployment demo VPS where multiple users share
// one Canton sandbox. The host runs `scripts/reset-demo.sh` on a cron
// (Tier 1 — see deploy/etc/cron.d/irsforge-reset); the SPA reads this
// block and renders a top banner counting down to the next round-clock
// reset (Tier 2). Disabled by default so local `make demo` shows nothing.
//
// `intervalMinutes` must be one of the divisors of 60 we actually support
// (15, 20, 30, 60, 120, 240, …). The banner computes the next reset as
// `floor(nowUtcMs / intervalMs + 1) * intervalMs` — a positive integer
// number of minutes is sufficient; we don't enforce the divisor rule
// because the host cron line is the source of truth, not this schema.
export const demoResetSchema = z
  .object({
    enabled: z.boolean().default(false),
    intervalMinutes: z.number().int().positive().default(60),
    // Optional override for the banner copy. The default reads
    // "Shared demo — resets at HH:MM UTC. Your changes will be wiped."
    // Override when the deployment carries a different reset story
    // (e.g. judges-only sandbox, longer interval).
    message: z.string().optional(),
  })
  .default({})

export type DemoReset = z.infer<typeof demoResetSchema>
