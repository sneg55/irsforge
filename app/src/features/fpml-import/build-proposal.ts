import type {
  BasisPayload,
  Classification,
  IrsLikePayload,
  ParsedLeg,
  TypedProposal,
  XccyPayload,
} from './types'

/**
 * ISO day-count fraction → Daml dayCountConvention string. The Daml side
 * accepts Act360 / Act365Fixed / Basis30360 (see `build-proposal-payload.ts`
 * workspace map). We default to Act360 for anything unrecognised — the
 * demo YAML scheduleDefaults pick Act360 everywhere today.
 */
const DAY_COUNT_MAP: Record<string, string> = {
  'ACT/360': 'Act360',
  'ACT/365': 'Act365Fixed',
  'ACT/365.FIXED': 'Act365Fixed',
  'ACT/365F': 'Act365Fixed',
  '30/360': 'Basis30360',
  '30E/360': 'Basis30360',
}

function normalizeDayCount(fpmlFraction: string): string {
  return DAY_COUNT_MAP[fpmlFraction.toUpperCase()] ?? 'Act360'
}

function toIsoDate(d: Date): string {
  // Use UTC slice to avoid TZ-shift: 2026-04-16 local midnight was
  // already serialised as a UTC date by `parseFpml`.
  return d.toISOString().slice(0, 10)
}

/**
 * Promote a Classification into the canonical TypedProposal shape shared
 * with the export path. Pairs with `buildFpmlXml` so the round-trip
 * `build → xml → parse → classify → build` is the identity on TypedProposal.
 *
 * Direction is decoded from `payerPartyReference.href` on the fixed/first leg:
 * - href="party1" (partyA is payer) → `fixedDirection: 'pay'` / `leg0Direction: 'pay'`
 * - href="party2" (partyA is receiver) → `'receive'`
 * - absent (legacy XML) → default ('receive' for fixed legs, 'pay' for basis leg-0)
 */
export function buildProposalFromClassification(
  classification: Classification,
  effectiveDate: Date,
  terminationDate: Date,
): TypedProposal {
  const startDate = toIsoDate(effectiveDate)
  const maturityDate = toIsoDate(terminationDate)

  switch (classification.productType) {
    case 'IRS':
    case 'OIS': {
      const payload = buildIrsLikePayload(
        classification.fixedLeg,
        classification.floatLeg,
        startDate,
        maturityDate,
      )
      return { type: classification.productType, payload }
    }
    case 'BASIS': {
      const payload = buildBasisPayload(
        classification.legA,
        classification.legB,
        startDate,
        maturityDate,
      )
      return { type: 'BASIS', payload }
    }
    case 'XCCY': {
      const payload = buildXccyPayload(
        classification.fixedLeg,
        classification.floatLeg,
        startDate,
        maturityDate,
      )
      return { type: 'XCCY', payload }
    }
    case null:
      throw new Error(`Cannot build proposal: ${classification.reason}`)
  }
}

/**
 * Decode direction from a leg's payerPartyRef href.
 * 'party1' = partyA is payer → 'pay'; 'party2' = partyA is receiver → 'receive'.
 * Returns the provided default when the ref is absent (legacy XML).
 */
function directionFromPayerRef(
  payerPartyRef: string | undefined,
  defaultDir: 'pay' | 'receive',
): 'pay' | 'receive' {
  if (payerPartyRef === 'party1') return 'pay'
  if (payerPartyRef === 'party2') return 'receive'
  return defaultDir
}

function buildIrsLikePayload(
  fixedLeg: ParsedLeg,
  floatLeg: ParsedLeg,
  startDate: string,
  maturityDate: string,
): IrsLikePayload {
  if (fixedLeg.currency !== floatLeg.currency) {
    throw new Error(
      `IRS/OIS legs must share currency; got ${fixedLeg.currency} vs ${floatLeg.currency}`,
    )
  }
  return {
    notional: fixedLeg.notional,
    currency: fixedLeg.currency,
    fixRate: fixedLeg.fixedRate ?? 0,
    floatingRateId: floatLeg.indexId ?? '',
    floatingSpread: floatLeg.spread ?? 0,
    startDate,
    maturityDate,
    dayCount: normalizeDayCount(fixedLeg.dayCountFraction),
    fixedDirection: directionFromPayerRef(fixedLeg.payerPartyRef, 'receive'),
  }
}

function buildBasisPayload(
  legA: ParsedLeg,
  legB: ParsedLeg,
  startDate: string,
  maturityDate: string,
): BasisPayload {
  if (legA.currency !== legB.currency) {
    throw new Error('BASIS legs must share currency')
  }
  if (legA.notional !== legB.notional) {
    throw new Error('BASIS legs must share notional')
  }
  return {
    notional: legA.notional,
    currency: legA.currency,
    leg0IndexId: legA.indexId ?? '',
    leg1IndexId: legB.indexId ?? '',
    leg0Spread: legA.spread ?? 0,
    leg1Spread: legB.spread ?? 0,
    startDate,
    maturityDate,
    dayCount: normalizeDayCount(legA.dayCountFraction),
    leg0Direction: directionFromPayerRef(legA.payerPartyRef, 'pay'),
  }
}

function buildXccyPayload(
  fixedLeg: ParsedLeg,
  floatLeg: ParsedLeg,
  startDate: string,
  maturityDate: string,
): XccyPayload {
  return {
    fixedCurrency: fixedLeg.currency,
    fixedNotional: fixedLeg.notional,
    fixedRate: fixedLeg.fixedRate ?? 0,
    floatCurrency: floatLeg.currency,
    floatNotional: floatLeg.notional,
    floatIndexId: floatLeg.indexId ?? '',
    floatSpread: floatLeg.spread ?? 0,
    startDate,
    maturityDate,
    dayCount: normalizeDayCount(fixedLeg.dayCountFraction),
    fixedDirection: directionFromPayerRef(fixedLeg.payerPartyRef, 'receive'),
  }
}
