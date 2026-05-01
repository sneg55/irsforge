/**
 * Pure helpers that project a per-family `SwapInstrumentPayload` to the
 * display values used by the blotter rows and the workspace right-panel.
 * They live in `shared/ledger/` so any feature can call them without
 * cross-feature imports — see `frontend-style.md` rule
 * "Feature modules are self-contained; shared code only in `shared/`".
 *
 * Loading placeholders ('USD' / 'pay' / '—') are documented as DISPLAY
 * loading state for the brief window before `useSwapInstruments`
 * resolves the instrument fetch — they are NOT defensive fallbacks for
 * missing data (see memory: feedback_no_defensive_fallbacks.md).
 */

import { streamToParsedLeg } from '@irsforge/shared-pricing'
import type { SwapInstrumentPayload } from './swap-instrument-types'

/**
 * Returns the display currency for a row.
 *
 * When `instr` is undefined the instrument query is still in-flight — 'USD'
 * is a documented display-loading placeholder (NOT a defensive fallback per
 * `feedback_no_defensive_fallbacks.md`). The row re-renders once
 * `useSwapInstruments` resolves.
 */
export function getInstrumentCurrency(instr: SwapInstrumentPayload | undefined): string {
  if (!instr) return 'USD'
  switch (instr.swapType) {
    case 'IRS':
    case 'OIS':
      return instr.payload.currency.id.unpack
    case 'CDS':
      return instr.payload.currency.id.unpack
    case 'ASSET':
      return instr.payload.currency.id.unpack
    case 'CCY':
      return instr.payload.baseCurrency.id.unpack
    case 'FX':
      return instr.payload.baseCurrency.id.unpack
    case 'BASIS':
    case 'XCCY':
    case 'FpML':
      return instr.payload.currencies[0]?.id.unpack ?? 'USD'
  }
}

/**
 * Returns the direction for a row.
 *
 * Loading placeholder when `instr` is undefined: 'pay' (re-renders on resolve).
 */
export function getInstrumentDirection(
  instr: SwapInstrumentPayload | undefined,
  isPartyA: boolean,
): 'pay' | 'receive' {
  if (!instr) return 'pay'
  switch (instr.swapType) {
    case 'IRS':
    case 'OIS':
      return isPartyA ? 'pay' : 'receive'
    case 'FX':
      return isPartyA ? 'pay' : 'receive'
    case 'BASIS':
    case 'XCCY':
    case 'FpML':
      return isPartyA ? 'pay' : 'receive'
    case 'CDS':
      return instr.payload.ownerReceivesFix === isPartyA ? 'receive' : 'pay'
    case 'CCY':
      return instr.payload.ownerReceivesBase === isPartyA ? 'receive' : 'pay'
    case 'ASSET':
      return instr.payload.ownerReceivesRate === isPartyA ? 'receive' : 'pay'
  }
}

/**
 * Returns the maturity date string for a row.
 *
 * For FpML-backed families (BASIS/XCCY/FpML) the termination date is pulled
 * from the first leg's `calculationPeriodDates.terminationDate.unadjustedDate`
 * — the same field the shared FpML decoder uses.
 * Loading placeholder when `instr` is undefined: '—' (re-renders on resolve).
 */
export function getInstrumentMaturity(instr: SwapInstrumentPayload | undefined): string {
  if (!instr) return '—'
  switch (instr.swapType) {
    case 'IRS':
    case 'OIS':
      return instr.payload.periodicSchedule.terminationDate
    case 'CDS':
      return instr.payload.periodicSchedule.terminationDate
    case 'CCY':
      return instr.payload.periodicSchedule.terminationDate
    case 'ASSET':
      return instr.payload.periodicSchedule.terminationDate
    case 'FX':
      return instr.payload.maturityDate
    case 'BASIS':
    case 'XCCY':
    case 'FpML':
      return (
        instr.payload.swapStreams[0]?.calculationPeriodDates.terminationDate.unadjustedDate ?? '—'
      )
  }
}

/**
 * Returns the effective (trade) date string for a row.
 *
 * Loading placeholder when `instr` is undefined: '—' (re-renders on resolve).
 */
export function getInstrumentTradeDate(instr: SwapInstrumentPayload | undefined): string {
  if (!instr) return '—'
  switch (instr.swapType) {
    case 'IRS':
    case 'OIS':
    case 'CDS':
    case 'CCY':
    case 'ASSET':
      return instr.payload.periodicSchedule.effectiveDate
    case 'FX':
      return instr.payload.issueDate
    case 'BASIS':
    case 'XCCY':
    case 'FpML':
      return (
        instr.payload.swapStreams[0]?.calculationPeriodDates.effectiveDate.unadjustedDate ?? '—'
      )
  }
}

function formatRatePct(rateStr: string): string {
  const n = parseFloat(rateStr)
  if (!Number.isFinite(n)) return rateStr
  // Daml carries the rate as a decimal (e.g. 0.0425). Render as "4.25%"
  // with up to two decimals; trim trailing zeros so 5% reads as "5%" not
  // "5.00%".
  const pct = (n * 100).toFixed(2).replace(/\.?0+$/, '')
  return `${pct}%`
}

function formatBpSpread(spreadStr: string | undefined): string {
  if (!spreadStr) return ''
  const n = parseFloat(spreadStr)
  if (!Number.isFinite(n) || n === 0) return ''
  // Daml spreads are decimal (0.0025 ⇒ 25 bp). Sign-preserving.
  const bp = Math.round(n * 10_000)
  return bp > 0 ? `+${bp}bp` : `${bp}bp`
}

/**
 * Returns a one-line leg detail string used as a subtitle in the blotter
 * DIRECTION column (e.g. `Fixed 4.25% / SOFR`). Reads from the `paying`
 * leg's perspective so it composes with the colored Pay/Receive label.
 *
 * Returns empty string for FX (no rate legs) or when the instrument hasn't
 * resolved yet — caller hides the subtitle in that case.
 */
export function getInstrumentLegDetail(instr: SwapInstrumentPayload | undefined): string {
  if (!instr) return ''
  switch (instr.swapType) {
    case 'IRS':
    case 'OIS': {
      const fixed = `Fixed ${formatRatePct(instr.payload.fixRate)}`
      const float = instr.payload.floatingRate.referenceRateId
      return `${fixed} / ${float}`
    }
    case 'CDS':
      return `Fixed ${formatRatePct(instr.payload.fixRate)} / Protection`
    case 'CCY':
      return `Fixed ${formatRatePct(instr.payload.baseRate)} / Fixed ${formatRatePct(instr.payload.foreignRate)}`
    case 'ASSET': {
      const fixed = `Fixed ${formatRatePct(instr.payload.fixRate)}`
      const ref = instr.payload.floatingRate?.referenceRateId
      return ref ? `${fixed} / ${ref}` : `${fixed} / Asset`
    }
    case 'FX':
      return ''
    case 'BASIS':
    case 'XCCY':
    case 'FpML': {
      // Reuse the shared FpML decoder so the blotter speaks the same
      // schema as the pricer; otherwise a stream-shape change would have to
      // be patched in two places.
      const streams = instr.payload.swapStreams.slice(0, 2)
      const labels = streams.map((s) => {
        try {
          const leg = streamToParsedLeg(s)
          if (leg.rateType === 'fixed') {
            if (leg.fixedRate === undefined) return 'Leg'
            return `Fixed ${formatRatePct(leg.fixedRate.toString())}`
          }
          const sp = leg.spread ? formatBpSpread(leg.spread.toString()) : ''
          return `${leg.indexId}${sp}`
        } catch {
          // Decoder rejected the stream (e.g. FxLinked notional). Drop a
          // generic label rather than leaking a parser error into the row.
          return 'Leg'
        }
      })
      return labels.length === 2 ? `${labels[0]} / ${labels[1]}` : (labels[0] ?? '')
    }
  }
}

/**
 * Returns true when the swap matures within the next `windowDays` (default
 * 7). Used by the blotter to surface a "Maturing this week" sub-status so
 * ops can triage upcoming terminal events from the home screen.
 */
export function isMaturingWithin(
  instr: SwapInstrumentPayload | undefined,
  windowDays = 7,
  now: Date = new Date(),
): boolean {
  const m = getInstrumentMaturity(instr)
  if (m === '—') return false
  const mat = new Date(m)
  if (Number.isNaN(mat.getTime())) return false
  const diffDays = (mat.getTime() - now.getTime()) / 86_400_000
  return diffDays >= 0 && diffDays <= windowDays
}
