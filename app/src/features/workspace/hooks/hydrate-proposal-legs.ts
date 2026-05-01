import type { LegConfig, SwapType } from '../types'
import type { WorkspaceDates } from '../utils/date-recalc'
import { computeTenor } from '../utils/tenor-parser'

// Inverse of build-proposal-payload.ts: take a raw payload from /v1/query and
// produce the workspace shape. Without this the workspace displays its
// hardcoded IRS defaults (50M / 4.25% / 5Y) for every proposal, regardless of
// which one the blotter row pointed at.

type DayCountOut = 'ACT_360' | 'ACT_365' | 'THIRTY_360' | 'THIRTY_E_360'

const DAML_TO_UI_DAYCOUNT: Record<string, DayCountOut> = {
  Act360: 'ACT_360',
  Act365Fixed: 'ACT_365',
  Basis30360: 'THIRTY_360',
  Basis30E360: 'THIRTY_E_360',
}

function dayCount(raw: unknown): DayCountOut {
  return DAML_TO_UI_DAYCOUNT[String(raw)] ?? 'ACT_360'
}

// Decimal fields arrive as JSON strings from Canton. Parse defensively — an
// unparseable value should fall back to 0 rather than propagate NaN into the
// pricing engine (see use-workspace-reducer UPDATE_LEG coercion).
function num(raw: unknown, fallback = 0): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
  return Number.isFinite(n) ? n : fallback
}

// Canton dates are ISO "YYYY-MM-DD" strings.
function parseDate(raw: unknown): Date {
  const s = String(raw ?? '')
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d)
}

// IRS tenor enum → approximate day count so effective+tenor→maturityDate mirrors
// the Daml Accept arithmetic. The workspace displays this as a Tenor object;
// the pricing cashflows use maturityDate itself so sub-day accuracy is fine.
const TENOR_DAYS: Record<string, number> = {
  D30: 30,
  D90: 91,
  D180: 182,
  Y1: 365,
  Y2: 730,
  Y3: 1095,
  Y5: 1826,
  Y10: 3652,
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function buildDates(effectiveDate: Date, maturityDate: Date): WorkspaceDates {
  return {
    tradeDate: new Date(effectiveDate),
    effectiveDate,
    maturityDate,
    tenor: computeTenor(effectiveDate, maturityDate),
    anchor: 'tenor',
    effManuallySet: false,
  }
}

// Canton party ids arrive as "Hint::<fingerprint>"; the UI and the ledger
// client both operate on the hint only.
function partyHint(party: unknown): string {
  return String(party ?? '').split('::')[0] ?? ''
}

export interface HydratedProposal {
  swapType: SwapType
  legs: LegConfig[]
  dates: WorkspaceDates
  counterpartyHint: string
}

type Payload = Record<string, unknown>

function scheduleFromDates(dates: WorkspaceDates) {
  return {
    startDate: dates.effectiveDate,
    endDate: dates.maturityDate,
    frequency: 'Quarterly' as const,
  }
}

function hydrateIrs(p: Payload, activeParty: string): HydratedProposal {
  const effective = parseDate(p.startDate)
  const tenorKey = String(p.tenor ?? 'Y1')
  const maturity = addDays(effective, TENOR_DAYS[tenorKey] ?? 365)
  const dates = buildDates(effective, maturity)
  const schedule = scheduleFromDates(dates)
  const notional = num(p.notional)
  const dc = dayCount(p.dayCountConvention)
  // Post-Phase-3: the IRS proposal no longer carries `floatingRateId` —
  // the counterparty picks a FloatingRateIndex at accept-time. The UI
  // shows a SOFR/ON placeholder for the float leg so proposers see the
  // intended index family; the authoritative value lands on the
  // on-chain instrument after Accept.
  const legs: LegConfig[] = [
    {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional,
      rate: num(p.fixRate),
      dayCount: dc,
      schedule,
    },
    {
      legType: 'float',
      direction: 'pay',
      currency: 'USD',
      notional,
      indexId: 'USD-SOFR',
      spread: 0,
      dayCount: dc,
      schedule,
    },
  ]
  return { swapType: 'IRS', legs, dates, counterpartyHint: otherParty(p, activeParty) }
}

function hydrateBasis(p: Payload, activeParty: string): HydratedProposal {
  // Two float legs, single currency. The proposal on-chain does not carry
  // per-leg indexIds (those are resolved at Accept time via two
  // FloatingRateIndex CIDs); fall back to the workspace's canonical
  // USD-SOFR / USD-EFFR defaults so the preview matches what the demo
  // flow will settle.
  const dates = buildDates(parseDate(p.startDate), parseDate(p.maturityDate))
  const schedule = scheduleFromDates(dates)
  const notional = num(p.notional)
  const dc = dayCount(p.dayCountConvention)
  const currency = String(p.currency ?? 'USD')
  const legs: LegConfig[] = [
    {
      legType: 'float',
      direction: 'pay',
      currency,
      notional,
      indexId: 'USD-SOFR',
      spread: num(p.leg0Spread),
      dayCount: dc,
      schedule,
    },
    {
      legType: 'float',
      direction: 'receive',
      currency,
      notional,
      indexId: 'USD-EFFR',
      spread: num(p.leg1Spread),
      dayCount: dc,
      schedule,
    },
  ]
  return { swapType: 'BASIS', legs, dates, counterpartyHint: otherParty(p, activeParty) }
}

function hydrateOis(p: Payload, activeParty: string): HydratedProposal {
  const dates = buildDates(parseDate(p.startDate), parseDate(p.maturityDate))
  // OIS defaults to annual payment frequency; overrides the shared
  // quarterly `scheduleFromDates` helper so the blotter preview matches
  // the on-chain schedule.
  const schedule = { ...scheduleFromDates(dates), frequency: 'Annual' as const }
  const notional = num(p.notional)
  const dc = dayCount(p.dayCountConvention)
  const legs: LegConfig[] = [
    {
      legType: 'fixed',
      direction: 'receive',
      currency: 'USD',
      notional,
      rate: num(p.fixRate),
      dayCount: dc,
      schedule,
    },
    {
      legType: 'float',
      direction: 'pay',
      currency: 'USD',
      notional,
      indexId: 'USD-SOFR',
      spread: 0,
      dayCount: dc,
      schedule,
    },
  ]
  return { swapType: 'OIS', legs, dates, counterpartyHint: otherParty(p, activeParty) }
}

function hydrateCds(p: Payload, activeParty: string): HydratedProposal {
  const dates = buildDates(parseDate(p.startDate), parseDate(p.maturityDate))
  const schedule = scheduleFromDates(dates)
  const notional = num(p.notional)
  const dc = dayCount(p.dayCountConvention)
  const legs: LegConfig[] = [
    {
      legType: 'fixed',
      direction: 'pay',
      currency: 'USD',
      notional,
      rate: num(p.fixRate),
      dayCount: dc,
      schedule,
    },
    { legType: 'protection', direction: 'receive', notional, recoveryRate: 0.4 },
  ]
  return { swapType: 'CDS', legs, dates, counterpartyHint: otherParty(p, activeParty) }
}

function hydrateCcy(p: Payload, activeParty: string): HydratedProposal {
  const dates = buildDates(parseDate(p.startDate), parseDate(p.maturityDate))
  const schedule = scheduleFromDates(dates)
  const notional = num(p.notional)
  const dc = dayCount(p.dayCountConvention)
  const legs: LegConfig[] = [
    {
      legType: 'fixed',
      direction: 'pay',
      currency: String(p.baseCurrency ?? 'USD'),
      notional,
      rate: num(p.baseRate, 0.04),
      dayCount: dc,
      schedule,
    },
    {
      legType: 'fixed',
      direction: 'receive',
      currency: String(p.foreignCurrency ?? 'EUR'),
      notional: notional * num(p.fxRate, 1),
      rate: num(p.foreignRate, 0.035),
      dayCount: dc,
      schedule,
    },
  ]
  return { swapType: 'CCY', legs, dates, counterpartyHint: otherParty(p, activeParty) }
}

function hydrateFx(p: Payload, activeParty: string): HydratedProposal {
  const first = parseDate(p.firstPaymentDate)
  const mat = parseDate(p.maturityDate)
  const dates = buildDates(first, mat)
  const notional = num(p.notional)
  const legs: LegConfig[] = [
    {
      legType: 'fx',
      direction: 'pay',
      baseCurrency: String(p.baseCurrency ?? 'USD'),
      foreignCurrency: String(p.foreignCurrency ?? 'EUR'),
      notional,
      fxRate: num(p.firstFxRate, 1),
      paymentDate: first,
    },
    {
      legType: 'fx',
      direction: 'receive',
      baseCurrency: String(p.baseCurrency ?? 'USD'),
      foreignCurrency: String(p.foreignCurrency ?? 'EUR'),
      notional,
      fxRate: num(p.finalFxRate, 1),
      paymentDate: mat,
    },
  ]
  return { swapType: 'FX', legs, dates, counterpartyHint: otherParty(p, activeParty) }
}

function hydrateAsset(p: Payload, activeParty: string): HydratedProposal {
  const dates = buildDates(parseDate(p.startDate), parseDate(p.maturityDate))
  const schedule = scheduleFromDates(dates)
  const notional = num(p.notional)
  const dc = dayCount(p.dayCountConvention)
  const ids = (p.underlyingAssetIds as unknown[] | undefined) ?? []
  const weights = (p.underlyingWeights as unknown[] | undefined) ?? []
  const underlyings = ids.map((id, i) => ({
    assetId: String(id),
    weight: num(weights[i], 1),
    initialPrice: 100,
    currentPrice: 100,
  }))
  // Post-Phase-3: the ASSET proposal no longer carries `floatingRateId` —
  // the counterparty picks a FloatingRateIndex at accept-time. The UI
  // shows a fixed leg at the proposed `fixRate`; the authoritative
  // float reference lands on the on-chain Asset instrument after Accept.
  const rateLeg: LegConfig = {
    legType: 'fixed',
    direction: 'pay',
    currency: 'USD',
    notional,
    rate: num(p.fixRate),
    dayCount: dc,
    schedule,
  }
  const legs: LegConfig[] = [
    { legType: 'asset', direction: 'receive', notional, underlyings },
    rateLeg,
  ]
  return { swapType: 'ASSET', legs, dates, counterpartyHint: otherParty(p, activeParty) }
}

function hydrateFpml(p: Payload, activeParty: string): HydratedProposal {
  const dates = buildDates(parseDate(p.startDate), parseDate(p.maturityDate))
  const schedule = scheduleFromDates(dates)
  const fpmlLegs = (p.legs as Payload[] | undefined) ?? []
  const legs: LegConfig[] = fpmlLegs.map((l) => {
    const notional = num(l.notional)
    const dc = dayCount(l.dayCountConvention)
    const currency = String(l.currency ?? 'USD')
    if (String(l.legType) === 'fixed') {
      return {
        legType: 'fixed',
        direction: 'receive' as const,
        currency,
        notional,
        rate: num(l.rate),
        dayCount: dc,
        schedule,
      }
    }
    return {
      legType: 'float',
      direction: 'pay' as const,
      currency,
      notional,
      indexId: String(l.indexId ?? 'USD-SOFR'),
      spread: num(l.spread),
      dayCount: dc,
      schedule,
    }
  })
  return { swapType: 'FpML', legs, dates, counterpartyHint: otherParty(p, activeParty) }
}

function otherParty(p: Payload, activeParty: string): string {
  const proposerHint = partyHint(p.proposer)
  const counterpartyHint = partyHint(p.counterparty)
  const actHint = activeParty.toLowerCase()
  // The "counterparty" from the active user's perspective is whoever *isn't*
  // them; on the ledger the proposer may be either side.
  if (proposerHint.toLowerCase() === actHint) return counterpartyHint
  return proposerHint
}

// XCCY dormant until Stage E ships.
const HYDRATORS: Record<SwapType, (p: Payload, activeParty: string) => HydratedProposal> = {
  IRS: hydrateIrs,
  OIS: hydrateOis,
  BASIS: hydrateBasis,
  XCCY: hydrateCcy,
  CDS: hydrateCds,
  CCY: hydrateCcy,
  FX: hydrateFx,
  ASSET: hydrateAsset,
  FpML: hydrateFpml,
}

export function hydrateProposalPayload(
  swapType: SwapType,
  payload: Payload,
  activeParty: string,
): HydratedProposal {
  return HYDRATORS[swapType](payload, activeParty)
}
