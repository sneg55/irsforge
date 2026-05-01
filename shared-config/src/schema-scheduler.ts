import { z } from 'zod'

// Phase 6 Stage B — scheduler configuration.
//
// `enabled`: master kill-switch for the oracle scheduler service. When
// false the publisher / scheduler tick stays dormant; manual buttons in
// the UI remain the only path to lifecycle / netted-settle actions.
//
// `manualOverridesEnabled`: gates the manual lifecycle / settlement
// buttons in the frontend. Demo profile keeps them visible so a human
// can drive the demo end-to-end; production profile hides them so the
// scheduler is the only path to those choices (the on-chain choice
// controllers stay widened for both — see Stage A's sister-choice
// pattern — but the UI surface narrows).
//
// `cron.{trigger,settleNet,mature}`: cron expressions consumed by the
// Stage C scheduler service. The Daml side does not read these strings;
// they are purely an oracle-side concern. Six-field cron format
// (sec min hour dom mon dow) so sub-minute intervals stay expressible.
export const schedulerSchema = z.object({
  enabled: z.boolean().default(false),
  manualOverridesEnabled: z.boolean().default(true),
  cron: z
    .object({
      trigger: z.string().default('*/5 * * * * *'),
      settleNet: z.string().default('*/5 * * * * *'),
      mature: z.string().default('*/30 * * * * *'),
    })
    .default({}),
})
