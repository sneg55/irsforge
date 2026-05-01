import type {
  DayCountConvention,
  FixedLegConfig,
  FloatLegConfig,
  LegConfig,
  SwapConfig,
} from '@irsforge/shared-pricing'
import type { BasisPayload, IrsLikePayload, TypedProposal, XccyPayload } from './types'

/**
 * Daml day-count (Act360, ...) → workspace LegConfig day-count enum.
 * Inverse of the build-proposal-payload.ts map.
 */
const DAY_COUNT_TO_LEG: Record<string, DayCountConvention> = {
  Act360: 'ACT_360',
  Act365Fixed: 'ACT_365',
  Basis30360: 'THIRTY_360',
}

function toLegDayCount(daml: string): DayCountConvention {
  return DAY_COUNT_TO_LEG[daml] ?? 'ACT_360'
}

function defaultFrequency(type: TypedProposal['type']): 'Quarterly' | 'Annual' | 'SemiAnnual' {
  if (type === 'OIS') return 'Annual'
  if (type === 'XCCY') return 'SemiAnnual'
  return 'Quarterly'
}

/**
 * Lift a TypedProposal into the workspace's `SwapConfig` shape so
 * `HYDRATE_FROM_DRAFT` can seed the workspace reducer from an imported
 * FpML. The trade date is pinned to the start date — workspace recomputes
 * the tenor on mount.
 */
export function typedProposalToSwapConfig(proposal: TypedProposal): SwapConfig {
  const { type } = proposal
  switch (type) {
    case 'IRS':
    case 'OIS':
      return irsLikeToConfig(type, proposal.payload)
    case 'BASIS':
      return basisToConfig(proposal.payload)
    case 'XCCY':
      return xccyToConfig(proposal.payload)
  }
}

function irsLikeToConfig(type: 'IRS' | 'OIS', p: IrsLikePayload): SwapConfig {
  const effectiveDate = new Date(p.startDate)
  const maturityDate = new Date(p.maturityDate)
  const frequency = defaultFrequency(type)
  const schedule = { startDate: effectiveDate, endDate: maturityDate, frequency }

  const fixedDir = p.fixedDirection ?? 'receive'
  const floatDir: 'pay' | 'receive' = fixedDir === 'receive' ? 'pay' : 'receive'

  const fixedLeg: FixedLegConfig = {
    legType: 'fixed',
    direction: fixedDir,
    currency: p.currency,
    notional: p.notional,
    rate: p.fixRate,
    dayCount: toLegDayCount(p.dayCount),
    schedule,
  }
  const floatLeg: FloatLegConfig = {
    legType: 'float',
    direction: floatDir,
    currency: p.currency,
    notional: p.notional,
    indexId: p.floatingRateId,
    spread: p.floatingSpread,
    dayCount: toLegDayCount(p.dayCount),
    schedule,
  }
  return {
    type,
    legs: [fixedLeg, floatLeg],
    tradeDate: effectiveDate,
    effectiveDate,
    maturityDate,
  }
}

function basisToConfig(p: BasisPayload): SwapConfig {
  const effectiveDate = new Date(p.startDate)
  const maturityDate = new Date(p.maturityDate)
  const schedule = {
    startDate: effectiveDate,
    endDate: maturityDate,
    frequency: 'Quarterly' as const,
  }
  const dayCount = toLegDayCount(p.dayCount)

  const leg0Dir = p.leg0Direction ?? 'pay'
  const leg1Dir: 'pay' | 'receive' = leg0Dir === 'pay' ? 'receive' : 'pay'

  const legs: LegConfig[] = [
    {
      legType: 'float',
      direction: leg0Dir,
      currency: p.currency,
      notional: p.notional,
      indexId: p.leg0IndexId,
      spread: p.leg0Spread,
      dayCount,
      schedule,
    },
    {
      legType: 'float',
      direction: leg1Dir,
      currency: p.currency,
      notional: p.notional,
      indexId: p.leg1IndexId,
      spread: p.leg1Spread,
      dayCount,
      schedule,
    },
  ]
  return {
    type: 'BASIS',
    legs,
    tradeDate: effectiveDate,
    effectiveDate,
    maturityDate,
  }
}

function xccyToConfig(p: XccyPayload): SwapConfig {
  const effectiveDate = new Date(p.startDate)
  const maturityDate = new Date(p.maturityDate)
  const schedule = {
    startDate: effectiveDate,
    endDate: maturityDate,
    frequency: 'SemiAnnual' as const,
  }
  const dayCount = toLegDayCount(p.dayCount)

  const fixedDir = p.fixedDirection ?? 'receive'
  const floatDir: 'pay' | 'receive' = fixedDir === 'receive' ? 'pay' : 'receive'

  const legs: LegConfig[] = [
    {
      legType: 'fixed',
      direction: fixedDir,
      currency: p.fixedCurrency,
      notional: p.fixedNotional,
      rate: p.fixedRate,
      dayCount,
      schedule,
    },
    {
      legType: 'float',
      direction: floatDir,
      currency: p.floatCurrency,
      notional: p.floatNotional,
      indexId: p.floatIndexId,
      spread: p.floatSpread,
      dayCount,
      schedule,
    },
  ]
  return {
    type: 'XCCY',
    legs,
    tradeDate: effectiveDate,
    effectiveDate,
    maturityDate,
  }
}
