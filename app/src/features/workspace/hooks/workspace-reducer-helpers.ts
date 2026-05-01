// Pure helper functions for the workspace reducer.
// Kept separate to hold the reducer file under 300 lines.

import type { LegConfig, LegDirection, SwapConfig, SwapType } from '../types'
import type { WorkspaceDates } from '../utils/date-recalc'

/**
 * Single-currency swap types (IRS/OIS/BASIS) default to notionalLinked=true
 * because both legs share the same notional by convention. Multi-currency and
 * structured products default to false because their notionals legitimately differ.
 */
const LINKED_SWAP_TYPES = new Set<SwapType>(['IRS', 'OIS', 'BASIS'])

export function notionalLinkedDefault(swapType: SwapType): boolean {
  return LINKED_SWAP_TYPES.has(swapType)
}

export function buildDefaultFloat(): LegConfig {
  const now = new Date()
  const end = new Date(now)
  end.setFullYear(end.getFullYear() + 5)
  return {
    legType: 'float',
    direction: 'pay',
    currency: 'USD',
    notional: 10_000_000,
    indexId: 'USD-SOFR',
    spread: 0,
    dayCount: 'ACT_360',
    schedule: { startDate: now, endDate: end, frequency: 'Quarterly' },
  }
}

export function syncLegSchedules(legs: LegConfig[], dates: WorkspaceDates): LegConfig[] {
  return legs.map((leg) => {
    if ('schedule' in leg && leg.schedule) {
      return {
        ...leg,
        schedule: { ...leg.schedule, startDate: dates.effectiveDate, endDate: dates.maturityDate },
      }
    }
    return leg
  })
}

// Default leg[0]/leg[1] directions per swap type — mirrors constants.ts defaultLegs.
// Used to back-fill pre-Phase-A localStorage drafts that were saved without the
// `direction` field, so the pricing engine's directionSign helper never sees
// `undefined` and silently falls through to +1 (receive).
const DEFAULT_DIRECTIONS: Record<SwapType, [LegDirection, LegDirection]> = {
  IRS: ['receive', 'pay'],
  OIS: ['receive', 'pay'],
  XCCY: ['receive', 'pay'],
  BASIS: ['pay', 'receive'],
  CDS: ['pay', 'receive'],
  CCY: ['pay', 'receive'],
  FX: ['pay', 'receive'],
  ASSET: ['receive', 'pay'],
  FpML: ['receive', 'pay'],
}

export function backfillDirection(config: SwapConfig): SwapConfig {
  const defaults = DEFAULT_DIRECTIONS[config.type]
  const legs = config.legs.map((leg, i) => {
    if (leg.direction !== undefined) return leg
    const fallback: LegDirection = defaults[i] ?? 'receive'
    return { ...leg, direction: fallback }
  })
  return { ...config, legs }
}
