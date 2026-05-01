// XML-free FpML taxonomy classifier. The XML-parsing source (`parseFpml`)
// stays in app/src/features/fpml-import/classify.ts because it depends on
// fast-xml-parser; this file consumes already-parsed objects so the oracle
// replay path can route on-chain `swapStreams` through the same logic.

import type { Classification, ParsedFpml, ParsedLeg } from './types.js'

const OVERNIGHT_INDEX = /(SOFR|ESTR|SONIA|TONA|CORRA|SARON|HONIA)/i

/**
 * Route a parsed FpML pair into one of the four taxonomy products. The
 * rules mirror the on-chain Accept choices — BASIS is two floats in one
 * currency, XCCY is fixed+float across currencies, OIS is vanilla
 * IRS with an overnight-compounded float leg.
 */
export function classify(parsed: ParsedFpml): Classification {
  if (parsed.legs.length !== 2) {
    return {
      productType: null,
      reason: `Unsupported stream count ${parsed.legs.length} (expected 2)`,
    }
  }
  const [a, b] = parsed.legs
  const sameCcy = a.currency === b.currency
  const fixedLegs = parsed.legs.filter((l) => l.rateType === 'fixed')
  const floatLegs = parsed.legs.filter((l) => l.rateType === 'float')

  if (sameCcy && fixedLegs.length === 1 && floatLegs.length === 1) {
    const fixedLeg = fixedLegs[0]
    const floatLeg = floatLegs[0]
    if (isOis(floatLeg)) {
      return { productType: 'OIS', fixedLeg, floatLeg }
    }
    return { productType: 'IRS', fixedLeg, floatLeg }
  }

  if (sameCcy && floatLegs.length === 2) {
    return { productType: 'BASIS', legA: a, legB: b }
  }

  if (!sameCcy && fixedLegs.length === 1 && floatLegs.length === 1) {
    return { productType: 'XCCY', fixedLeg: fixedLegs[0], floatLeg: floatLegs[0] }
  }

  return { productType: null, reason: 'Unsupported leg shape' }
}

function isOis(leg: ParsedLeg): boolean {
  if (leg.compounding !== 'CompoundedInArrears') return false
  if (!leg.indexId) return false
  return OVERNIGHT_INDEX.test(leg.indexId)
}
