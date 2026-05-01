// FpML stream → SwapConfig builders. Takes classified ParsedLeg / ParsedFpml
// and shapes the pricer-facing SwapConfig. Ported from the oracle's replay
// adapters so the frontend blotter can use the same shaping logic.

import type {
  DayCountConvention,
  FixedLegConfig,
  FloatLegConfig,
  Frequency,
  SwapConfig,
} from '../engine/types.js'
import { classify } from './classify.js'
import type { ParsedFpml, ParsedLeg } from './types.js'

const DEFAULT_FREQUENCY: Frequency = 'Quarterly'

const DAY_COUNT_MAP: Record<string, DayCountConvention> = {
  Act360: 'ACT_360',
  ActActISDA: 'ACT_365',
  Basis30360: 'THIRTY_360',
  Basis30E360: 'THIRTY_E_360',
  ACT_360: 'ACT_360',
  ACT_365: 'ACT_365',
  THIRTY_360: 'THIRTY_360',
  THIRTY_E_360: 'THIRTY_E_360',
}

export function mapDayCount(damlDc: string): DayCountConvention {
  const mapped = DAY_COUNT_MAP[damlDc]
  if (!mapped) throw new Error(`fpml: unsupported dayCount ${damlDc}`)
  return mapped
}

function scheduleOf(parsed: ParsedFpml) {
  return {
    startDate: parsed.effectiveDate,
    endDate: parsed.terminationDate,
    frequency: DEFAULT_FREQUENCY,
  }
}

export function buildIrsLikeSwapConfig(
  fixedLeg: ParsedLeg,
  floatLeg: ParsedLeg,
  parsed: ParsedFpml,
): SwapConfig {
  const schedule = scheduleOf(parsed)
  const fixed: FixedLegConfig = {
    legType: 'fixed',
    direction: 'receive',
    currency: fixedLeg.currency,
    notional: fixedLeg.notional,
    rate: fixedLeg.fixedRate ?? 0,
    dayCount: mapDayCount(fixedLeg.dayCountFraction),
    schedule,
  }
  const float: FloatLegConfig = {
    legType: 'float',
    direction: 'pay',
    currency: floatLeg.currency,
    notional: -floatLeg.notional,
    indexId: floatLeg.indexId ?? '',
    spread: floatLeg.spread ?? 0,
    dayCount: mapDayCount(floatLeg.dayCountFraction),
    schedule,
  }
  return {
    type: 'IRS',
    legs: [fixed, float],
    tradeDate: parsed.effectiveDate,
    effectiveDate: parsed.effectiveDate,
    maturityDate: parsed.terminationDate,
  }
}

export function buildBasisSwapConfig(
  legA: ParsedLeg,
  legB: ParsedLeg,
  parsed: ParsedFpml,
): SwapConfig {
  const schedule = scheduleOf(parsed)
  const floatA: FloatLegConfig = {
    legType: 'float',
    direction: 'pay',
    currency: legA.currency,
    notional: legA.notional,
    indexId: legA.indexId ?? '',
    spread: legA.spread ?? 0,
    dayCount: mapDayCount(legA.dayCountFraction),
    schedule,
  }
  const floatB: FloatLegConfig = {
    legType: 'float',
    direction: 'receive',
    currency: legB.currency,
    notional: -legB.notional,
    indexId: legB.indexId ?? '',
    spread: legB.spread ?? 0,
    dayCount: mapDayCount(legB.dayCountFraction),
    schedule,
  }
  return {
    type: 'BASIS',
    legs: [floatA, floatB],
    tradeDate: parsed.effectiveDate,
    effectiveDate: parsed.effectiveDate,
    maturityDate: parsed.terminationDate,
  }
}

export function buildXccySwapConfig(
  fixedLeg: ParsedLeg,
  floatLeg: ParsedLeg,
  parsed: ParsedFpml,
): SwapConfig {
  const schedule = scheduleOf(parsed)
  const fixed: FixedLegConfig = {
    legType: 'fixed',
    direction: 'receive',
    currency: fixedLeg.currency,
    notional: fixedLeg.notional,
    rate: fixedLeg.fixedRate ?? 0,
    dayCount: mapDayCount(fixedLeg.dayCountFraction),
    schedule,
  }
  const float: FloatLegConfig = {
    legType: 'float',
    direction: 'pay',
    currency: floatLeg.currency,
    notional: -floatLeg.notional,
    indexId: floatLeg.indexId ?? '',
    spread: floatLeg.spread ?? 0,
    dayCount: mapDayCount(floatLeg.dayCountFraction),
    schedule,
  }
  return {
    type: 'XCCY',
    legs: [fixed, float],
    tradeDate: parsed.effectiveDate,
    effectiveDate: parsed.effectiveDate,
    maturityDate: parsed.terminationDate,
  }
}

/**
 * One-shot orchestrator: parsed FpML → classify → dispatch to the right
 * builder. Throws on unsupported stream shapes (classification.productType
 * === null) so callers get a clear failure surface instead of a
 * mysteriously-empty SwapConfig.
 */
export function parsedFpmlToSwapConfig(parsed: ParsedFpml): SwapConfig {
  const c = classify(parsed)
  switch (c.productType) {
    case 'IRS':
    case 'OIS':
      return buildIrsLikeSwapConfig(c.fixedLeg, c.floatLeg, parsed)
    case 'BASIS':
      return buildBasisSwapConfig(c.legA, c.legB, parsed)
    case 'XCCY':
      return buildXccySwapConfig(c.fixedLeg, c.floatLeg, parsed)
    case null:
      throw new Error(`parsedFpmlToSwapConfig: ${c.reason}`)
  }
}
