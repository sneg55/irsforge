'use client'

import { useCurveStaleness } from '@/features/operator/hooks/use-curve-staleness'

/**
 * Pre-NPV gate: the blotter prices every active swap off the curve book.
 * When any curve has aged past the operator's stale threshold, every NPV
 * downstream is suspect (basis swaps blow up if one side's projection
 * curve hasn't ticked; XCCY moves the wrong way if the FX or foreign
 * discount falls behind). We can't selectively grey out the specific
 * rows without re-deriving per-swap curve dependencies — surface a single
 * banner instead so the user reads "valuation is suspect" before they
 * read a number.
 */
export function ValuationStaleBanner() {
  const { entries } = useCurveStaleness()
  const stale = entries.filter((e) => e.stale)
  if (stale.length === 0) return null
  const labels = stale
    .map((e) => `${e.ccy} ${e.indexId ?? e.curveType}`)
    .slice(0, 4)
    .join(', ')
  const more = stale.length > 4 ? ` (+${stale.length - 4})` : ''
  return (
    <div
      data-testid="valuation-stale-banner"
      role="status"
      className="flex items-start gap-2 rounded border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200"
    >
      <span className="mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
      <span>
        Valuation may be stale — input curves have not refreshed: {labels}
        {more}. NPV and DV01 on rows that depend on these curves can drift until the publisher
        catches up.
      </span>
    </div>
  )
}
