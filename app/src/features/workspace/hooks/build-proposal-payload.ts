import type { LegConfig, SwapType } from '../types'
import {
  type BuildProposalResult,
  getDayCount,
  getNotional,
  type ProposalContext,
  validateCurrency,
} from './build-proposal-payload.helpers'

export {
  type BuildProposalError,
  type BuildProposalResult,
  type BuildProposalSuccess,
  PROPOSAL_TEMPLATES,
} from './build-proposal-payload.helpers'

export function buildProposalPayload(
  swapType: SwapType,
  legs: LegConfig[],
  ctx: ProposalContext,
  dates: { effectiveDate: Date; maturityDate: Date },
): BuildProposalResult {
  const { proposer, counterparty, operator, startDate, maturityDate, allowedCurrencies } = ctx

  switch (swapType) {
    case 'IRS': {
      const fixedLeg = legs.find((l) => l.legType === 'fixed')
      const floatLeg = legs.find((l) => l.legType === 'float')
      const daysDiff = Math.round(
        (dates.maturityDate.getTime() - dates.effectiveDate.getTime()) / 86400000,
      )
      let tenor = 'Y1'
      if (daysDiff <= 45) tenor = 'D30'
      else if (daysDiff <= 135) tenor = 'D90'
      else if (daysDiff <= 270) tenor = 'D180'
      // Post-Phase-3: the IRS proposal no longer carries `floatingRateId`.
      // The accepter picks a FloatingRateIndex contract id at accept-time;
      // the index's `indexId` and `lookback` flow into the instrument's
      // `FloatingRate` payload. `floatLeg` is unused here but kept in
      // the workspace UI so proposers can preview the intended index.
      void floatLeg
      return {
        ok: true,
        payload: {
          proposer,
          counterparty,
          operator,
          notional: fixedLeg && 'notional' in fixedLeg ? fixedLeg.notional : 0,
          fixRate: fixedLeg && 'rate' in fixedLeg ? fixedLeg.rate : 0,
          tenor,
          startDate,
          dayCountConvention: fixedLeg ? getDayCount(fixedLeg) : 'Act360',
        },
      }
    }
    case 'OIS': {
      // OIS uses explicit maturityDate (not tenor); otherwise the payload
      // shape mirrors IRS — the Accept body resolves the FloatingRateIndex
      // at accept-time via setup.scheduleDefaults["OIS"].
      const fixedLeg = legs.find((l) => l.legType === 'fixed')
      const floatLeg = legs.find((l) => l.legType === 'float')
      void floatLeg
      return {
        ok: true,
        payload: {
          proposer,
          counterparty,
          operator,
          notional: fixedLeg && 'notional' in fixedLeg ? fixedLeg.notional : 0,
          fixRate: fixedLeg && 'rate' in fixedLeg ? fixedLeg.rate : 0,
          startDate,
          maturityDate,
          dayCountConvention: fixedLeg ? getDayCount(fixedLeg) : 'Act360',
        },
      }
    }
    case 'BASIS': {
      // Two float legs, single currency. Per-leg index ids are kept in the
      // workspace UI (leg.indexId) for preview; the Accept choice reads
      // the authoritative FloatingRateIndex contracts at accept-time.
      const leg0 = legs[0]
      const leg1 = legs[1]
      const currency = leg0 && 'currency' in leg0 ? leg0.currency : 'USD'
      const legNotional = leg0 && 'notional' in leg0 ? leg0.notional : 0
      const leg0Spread = leg0 && 'spread' in leg0 ? (leg0.spread ?? 0) : 0
      const leg1Spread = leg1 && 'spread' in leg1 ? (leg1.spread ?? 0) : 0
      return {
        ok: true,
        payload: {
          proposer,
          counterparty,
          operator,
          notional: legNotional,
          currency,
          leg0Spread,
          leg1Spread,
          startDate,
          maturityDate,
          dayCountConvention: leg0 ? getDayCount(leg0) : 'Act360',
        },
      }
    }
    case 'XCCY': {
      // Cross-currency fixed + float. Leg 0 = fixed (fixedCurrency),
      // leg 1 = float (floatCurrency, compounded-in-arrears). The
      // XccyAccept choice resolves a FloatingRateIndex CID for the
      // float leg and enforces currency matching at accept-time.
      const fixedLeg = legs.find((l) => l.legType === 'fixed')
      const floatLeg = legs.find((l) => l.legType === 'float')
      const fixedCurrency = fixedLeg && 'currency' in fixedLeg ? fixedLeg.currency : 'USD'
      const floatCurrency = floatLeg && 'currency' in floatLeg ? floatLeg.currency : 'EUR'
      if (fixedCurrency === floatCurrency) {
        return {
          ok: false,
          field: 'floatCurrency',
          message: 'XCCY legs must use different currencies — see Phase 3 Stage E',
        }
      }
      const fixedErr = validateCurrency(fixedCurrency, 'fixedCurrency', allowedCurrencies)
      if (fixedErr) return fixedErr
      const floatErr = validateCurrency(floatCurrency, 'floatCurrency', allowedCurrencies)
      if (floatErr) return floatErr
      return {
        ok: true,
        payload: {
          proposer,
          counterparty,
          operator,
          fixedCurrency,
          fixedNotional: fixedLeg ? getNotional(fixedLeg) : 0,
          fixedRate: fixedLeg && 'rate' in fixedLeg ? fixedLeg.rate : 0,
          floatCurrency,
          floatNotional: floatLeg ? getNotional(floatLeg) : 0,
          startDate,
          maturityDate,
          dayCountConvention: fixedLeg ? getDayCount(fixedLeg) : 'Act360',
        },
      }
    }
    case 'CDS': {
      const premLeg = legs.find((l) => l.legType === 'fixed')
      const protLeg = legs.find((l) => l.legType === 'protection')
      return {
        ok: true,
        payload: {
          proposer,
          counterparty,
          operator,
          notional: protLeg ? getNotional(protLeg) : 0,
          fixRate: premLeg && 'rate' in premLeg ? premLeg.rate : 0.01,
          referenceName: 'DEFAULT',
          ownerReceivesFix: true,
          startDate,
          maturityDate,
          dayCountConvention: premLeg ? getDayCount(premLeg) : 'Act360',
        },
      }
    }
    case 'CCY': {
      const baseLeg = legs[0]
      const foreignLeg = legs[1]
      const baseCurrency = baseLeg && 'currency' in baseLeg ? baseLeg.currency : 'USD'
      const foreignCurrency = foreignLeg && 'currency' in foreignLeg ? foreignLeg.currency : 'EUR'
      const baseErr = validateCurrency(baseCurrency, 'baseCurrency', allowedCurrencies)
      if (baseErr) return baseErr
      const fErr = validateCurrency(foreignCurrency, 'foreignCurrency', allowedCurrencies)
      if (fErr) return fErr
      return {
        ok: true,
        payload: {
          proposer,
          counterparty,
          operator,
          notional: baseLeg ? getNotional(baseLeg) : 0,
          baseRate: baseLeg && 'rate' in baseLeg ? baseLeg.rate : 0.04,
          foreignRate: foreignLeg && 'rate' in foreignLeg ? foreignLeg.rate : 0.035,
          baseCurrency,
          foreignCurrency,
          fxRate: 1.08,
          ownerReceivesBase: true,
          startDate,
          maturityDate,
          dayCountConvention: baseLeg ? getDayCount(baseLeg) : 'Act360',
        },
      }
    }
    case 'FX': {
      const nearLeg = legs[0]
      const farLeg = legs[1]
      const baseCurrency = nearLeg && 'baseCurrency' in nearLeg ? nearLeg.baseCurrency : 'USD'
      const foreignCurrency =
        nearLeg && 'foreignCurrency' in nearLeg ? nearLeg.foreignCurrency : 'EUR'
      const baseErr = validateCurrency(baseCurrency, 'baseCurrency', allowedCurrencies)
      if (baseErr) return baseErr
      const fErr = validateCurrency(foreignCurrency, 'foreignCurrency', allowedCurrencies)
      if (fErr) return fErr
      return {
        ok: true,
        payload: {
          proposer,
          counterparty,
          operator,
          notional: nearLeg ? getNotional(nearLeg) : 0,
          baseCurrency,
          foreignCurrency,
          firstFxRate: nearLeg && 'fxRate' in nearLeg ? nearLeg.fxRate : 1.08,
          finalFxRate: farLeg && 'fxRate' in farLeg ? farLeg.fxRate : 1.085,
          firstPaymentDate: startDate,
          maturityDate,
        },
      }
    }
    case 'ASSET': {
      const assetLeg = legs.find((l) => l.legType === 'asset')
      const rateLeg = legs.find((l) => l.legType === 'fixed' || l.legType === 'float')
      // Post-Phase-3: the ASSET proposal no longer carries `floatingRateId`.
      // The accepter picks a FloatingRateIndex contract id at accept-time
      // (see `exerciseProposalChoice`); the index's `indexId` and
      // `lookback` flow into the Asset instrument's `FloatingRate` payload.
      // `rateLeg.indexId` stays in the workspace preview for UX only.
      return {
        ok: true,
        payload: {
          proposer,
          counterparty,
          operator,
          notional: assetLeg ? getNotional(assetLeg) : 0,
          fixRate: rateLeg && 'rate' in rateLeg ? rateLeg.rate : 0,
          ownerReceivesRate: true,
          underlyingAssetIds:
            assetLeg && 'underlyings' in assetLeg ? assetLeg.underlyings.map((u) => u.assetId) : [],
          underlyingWeights:
            assetLeg && 'underlyings' in assetLeg ? assetLeg.underlyings.map((u) => u.weight) : [],
          startDate,
          maturityDate,
          dayCountConvention: rateLeg ? getDayCount(rateLeg) : 'Act360',
        },
      }
    }
    case 'FpML':
      return {
        ok: true,
        payload: {
          proposer,
          counterparty,
          operator,
          legs: legs.map((l) => ({
            legType: l.legType,
            currency: 'currency' in l ? l.currency : 'USD',
            notional: 'notional' in l ? l.notional : 0,
            rate: 'rate' in l ? l.rate : null,
            indexId: 'indexId' in l ? l.indexId : null,
            spread: 'spread' in l ? l.spread : null,
            dayCountConvention: getDayCount(l),
          })),
          startDate,
          maturityDate,
          description: 'FpML multi-stream swap',
        },
      }
    default:
      return { ok: false, field: 'swapType', message: `Unsupported swap type: ${String(swapType)}` }
  }
}
