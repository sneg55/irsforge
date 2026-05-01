import { z } from 'zod'

// Participant-party hints the init flow and off-chain services consume.
// Only `scheduler` is configurable here today (Phase 6 introduces the
// scheduler party); the operator/partyA/partyB/regulator hints remain
// hardcoded in `Setup.Init.daml` until a separate migration lifts them
// into this block.
export const partyHintSchema = z.object({
  partyHint: z.string().min(1),
})

export const partiesSchema = z
  .object({
    scheduler: partyHintSchema.default({ partyHint: 'Scheduler' }),
  })
  .default({})
