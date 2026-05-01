import { XMLBuilder } from 'fast-xml-parser'
import type { BasisPayload, IrsLikePayload, TypedProposal, XccyPayload } from '../fpml-import/types'

/**
 * Daml dayCountConvention → FpML ISO dayCountFraction. Inverse of the
 * import-side DAY_COUNT_MAP so round-trip stays stable.
 */
const INV_DAY_COUNT: Record<string, string> = {
  Act360: 'ACT/360',
  Act365Fixed: 'ACT/365.FIXED',
  Basis30360: '30/360',
}

function toFpmlDayCount(daml: string): string {
  return INV_DAY_COUNT[daml] ?? 'ACT/360'
}

/**
 * Resolve payer/receiver hrefs from a `direction` value relative to partyA
 * (the trade owner). `direction = 'pay'` → partyA pays this leg, so payer=party1,
 * receiver=party2. `direction = 'receive'` → reversed.
 */
function partyRefs(direction: 'pay' | 'receive'): {
  payerPartyReference: { '@_href': string }
  receiverPartyReference: { '@_href': string }
} {
  return direction === 'pay'
    ? {
        payerPartyReference: { '@_href': 'party1' },
        receiverPartyReference: { '@_href': 'party2' },
      }
    : {
        payerPartyReference: { '@_href': 'party2' },
        receiverPartyReference: { '@_href': 'party1' },
      }
}

function buildFixedLeg(opts: {
  effective: string
  termination: string
  notional: number
  currency: string
  fixedRate: number
  dayCount: string
  direction?: 'pay' | 'receive'
}) {
  const refs = opts.direction ? partyRefs(opts.direction) : {}
  return {
    ...refs,
    calculationPeriodDates: {
      effectiveDate: { unadjustedDate: opts.effective },
      terminationDate: { unadjustedDate: opts.termination },
    },
    calculationPeriodAmount: {
      calculation: {
        notionalSchedule: {
          notionalStepSchedule: {
            initialValue: opts.notional,
            currency: opts.currency,
          },
        },
        fixedRateSchedule: { initialValue: opts.fixedRate },
        dayCountFraction: toFpmlDayCount(opts.dayCount),
      },
    },
  }
}

function buildFloatLeg(opts: {
  effective: string
  termination: string
  notional: number
  currency: string
  indexId: string
  spread: number
  dayCount: string
  compoundedInArrears: boolean
  overnightAverage?: boolean
  direction?: 'pay' | 'receive'
}) {
  const floatingRateCalculation: Record<string, unknown> = {
    floatingRateIndex: opts.indexId,
    spreadSchedule: { initialValue: opts.spread },
  }
  if (opts.compoundedInArrears) {
    floatingRateCalculation.compoundingMethod = 'CompoundedInArrears'
  } else if (opts.overnightAverage) {
    floatingRateCalculation.compoundingMethod = 'OvernightAverage'
  }

  const refs = opts.direction ? partyRefs(opts.direction) : {}
  return {
    ...refs,
    calculationPeriodDates: {
      effectiveDate: { unadjustedDate: opts.effective },
      terminationDate: { unadjustedDate: opts.termination },
    },
    calculationPeriodAmount: {
      calculation: {
        notionalSchedule: {
          notionalStepSchedule: {
            initialValue: opts.notional,
            currency: opts.currency,
          },
        },
        floatingRateCalculation,
        dayCountFraction: toFpmlDayCount(opts.dayCount),
      },
    },
  }
}

const OVERNIGHT_INDEX = /(SOFR|ESTR|SONIA|TONA|CORRA|SARON|HONIA)/i

function buildStreams(proposal: TypedProposal) {
  switch (proposal.type) {
    case 'IRS':
      return buildIrsStreams(proposal.payload, /* forceCompounding */ false)
    case 'OIS':
      return buildIrsStreams(proposal.payload, /* forceCompounding */ true)
    case 'BASIS':
      return buildBasisStreams(proposal.payload)
    case 'XCCY':
      return buildXccyStreams(proposal.payload)
  }
}

function buildIrsStreams(p: IrsLikePayload, forceCompoundedInArrears: boolean) {
  // Float direction is always opposite of fixed direction.
  const floatDir: 'pay' | 'receive' = p.fixedDirection === 'pay' ? 'receive' : 'pay'
  return [
    buildFixedLeg({
      effective: p.startDate,
      termination: p.maturityDate,
      notional: p.notional,
      currency: p.currency,
      fixedRate: p.fixRate,
      dayCount: p.dayCount,
      direction: p.fixedDirection,
    }),
    buildFloatLeg({
      effective: p.startDate,
      termination: p.maturityDate,
      notional: p.notional,
      currency: p.currency,
      indexId: p.floatingRateId,
      spread: p.floatingSpread,
      dayCount: p.dayCount,
      compoundedInArrears: forceCompoundedInArrears || OVERNIGHT_INDEX.test(p.floatingRateId),
      direction: floatDir,
    }),
  ]
}

function buildBasisStreams(p: BasisPayload) {
  const leg1Dir: 'pay' | 'receive' = p.leg0Direction === 'pay' ? 'receive' : 'pay'
  return [
    buildFloatLeg({
      effective: p.startDate,
      termination: p.maturityDate,
      notional: p.notional,
      currency: p.currency,
      indexId: p.leg0IndexId,
      spread: p.leg0Spread,
      dayCount: p.dayCount,
      compoundedInArrears:
        /SOFR|ESTR|SONIA|TONA|CORRA|SARON|HONIA/i.test(p.leg0IndexId) &&
        !/EFFR|FEDFUND/i.test(p.leg0IndexId),
      overnightAverage: /EFFR|FEDFUND/i.test(p.leg0IndexId),
      direction: p.leg0Direction,
    }),
    buildFloatLeg({
      effective: p.startDate,
      termination: p.maturityDate,
      notional: p.notional,
      currency: p.currency,
      indexId: p.leg1IndexId,
      spread: p.leg1Spread,
      dayCount: p.dayCount,
      compoundedInArrears:
        /SOFR|ESTR|SONIA|TONA|CORRA|SARON|HONIA/i.test(p.leg1IndexId) &&
        !/EFFR|FEDFUND/i.test(p.leg1IndexId),
      overnightAverage: /EFFR|FEDFUND/i.test(p.leg1IndexId),
      direction: leg1Dir,
    }),
  ]
}

function buildXccyStreams(p: XccyPayload) {
  const floatDir: 'pay' | 'receive' = p.fixedDirection === 'pay' ? 'receive' : 'pay'
  return [
    buildFixedLeg({
      effective: p.startDate,
      termination: p.maturityDate,
      notional: p.fixedNotional,
      currency: p.fixedCurrency,
      fixedRate: p.fixedRate,
      dayCount: p.dayCount,
      direction: p.fixedDirection,
    }),
    buildFloatLeg({
      effective: p.startDate,
      termination: p.maturityDate,
      notional: p.floatNotional,
      currency: p.floatCurrency,
      indexId: p.floatIndexId,
      spread: p.floatSpread,
      dayCount: p.dayCount,
      compoundedInArrears: true,
      direction: floatDir,
    }),
  ]
}

/**
 * Serialise a TypedProposal to an FpML 5.12-shaped XML string. Pairs with
 * `parseFpml + classify + buildProposalFromClassification` so round-trip is
 * structural-equal on TypedProposal.
 */
export function buildFpmlXml(proposal: TypedProposal): string {
  const tree = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    FpML: {
      '@_xmlns': 'http://www.fpml.org/FpML-5/confirmation',
      '@_fpmlVersion': '5-12',
      trade: {
        tradeHeader: { tradeDate: extractTradeDate(proposal) },
        swap: { swapStream: buildStreams(proposal) },
      },
    },
  }
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
    suppressEmptyNode: false,
    processEntities: true,
  })
  return builder.build(tree)
}

function extractTradeDate(proposal: TypedProposal): string {
  if (proposal.type === 'XCCY') return proposal.payload.startDate
  return proposal.payload.startDate
}
