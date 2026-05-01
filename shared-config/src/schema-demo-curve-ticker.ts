import { z } from 'zod'

// Demo-only cron that re-publishes the seeded stub curves with a small
// random perturbation on each pillar's zeroRate. Gives the blotter's
// sparkline something to trend on — without it, Canton's ACS holds
// exactly one Curve contract per key (PublishDiscountCurve archives the
// previous) and useCurveStream history stays pinned to a single point.
//
// `enabled` defaults to false so production configs never opt in by
// accident (though the profile=production validator already forbids a
// populated `demo:` block).
//
// `bpsRange` is the one-sided perturbation magnitude in basis points.
// A tick draws a uniform `[-bpsRange, +bpsRange]` bp offset per pillar
// and adds it to the seeded zeroRate. 1bp is enough to be visible
// without swinging valuations into noise.
export const demoCurveTickerSchema = z.object({
  enabled: z.boolean().default(false),
  cron: z.string().default('*/30 * * * * *'),
  bpsRange: z.number().positive().default(0.25),
})

export type DemoCurveTickerConfig = z.infer<typeof demoCurveTickerSchema>
