import type { CsaViewModel } from '@/features/csa/decode'

const STATE_PRIORITY: Record<CsaViewModel['state'], number> = {
  // Escalated rises above MarkDisputed because it requires operator
  // intervention; bilateral disputes can still self-resolve.
  Escalated: -1,
  MarkDisputed: 0,
  MarginCallOutstanding: 1,
  Active: 2,
}

/**
 * Disputes float to the top, then outstanding margin calls, then everything
 * else. Within a state, ties are broken by |posted-collateral| descending
 * so the largest exposures sit higher.
 */
export function sortCsasByFriction(csas: CsaViewModel[]): CsaViewModel[] {
  return [...csas].sort((a, b) => {
    const sp = STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state]
    if (sp !== 0) return sp
    return magnitude(b) - magnitude(a)
  })
}

function magnitude(c: CsaViewModel): number {
  let total = 0
  for (const v of c.postedByA.values()) total += Math.abs(v)
  for (const v of c.postedByB.values()) total += Math.abs(v)
  return total
}
